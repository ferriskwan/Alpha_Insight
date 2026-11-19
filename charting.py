import json
import logging
from typing import Dict, Any, Optional
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import matplotlib.dates as mdates
import mplfinance as mpf
import mplcursors
from zoneinfo import ZoneInfo

# inherit logging configuration from main.py
logger = logging.getLogger(__name__)

def calculate_rsi(series: pd.Series, period: int = 13) -> pd.Series:
    """Calculates the Relative Strength Index (RSI) using Wilder's EMA smoothing."""
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=period - 1, adjust=False).mean()
    avg_loss = loss.ewm(com=period - 1, adjust=False).mean()
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))

def candlestick_chart(
    data: Dict[str, Any], 
    output_path: Optional[str] = None,
    zoom_start: Optional[str] = None,
    zoom_end: Optional[str] = None
) -> None:
    # Extract meta data
    symbol = data['meta']['symbol']
    interval = data['meta']['interval']

    # 1. Convert TickData_generate output to DataFrame
    df = pd.DataFrame(data['values'])
    
    # If the interval is daily, we can treat timestamps as naive datetime objects. 
    # For intraday data, we need to handle timezones properly.
    if interval == '1d':
        df['timestamp'] = pd.to_datetime(df['timestamp'])
    else:
        timezone = data['meta'].get('timezone') or 'UTC'
        df['timestamp'] = pd.to_datetime(df['timestamp']).dt.tz_localize('UTC').dt.tz_convert(ZoneInfo(timezone))

    df.set_index('timestamp', inplace=True)
    df.sort_index(inplace=True)
    
    # Drop any records with missing price data to prevent NaN propagation
    df.dropna(subset=['open', 'high', 'low', 'close'], inplace=True)

    # 2. Calculate Indicators on FULL dataset first to avoid boundary estimation errors
    # MACD (12, 26, 9)
    df['EMA12'] = df['close'].ewm(span=12, adjust=False).mean()
    df['EMA26'] = df['close'].ewm(span=26, adjust=False).mean()
    df['MACD'] = df['EMA12'] - df['EMA26']
    df['Signal'] = df['MACD'].ewm(span=9, adjust=False).mean()
    df['Histogram'] = df['MACD'] - df['Signal']

    # Bollinger Bands (30, 2)
    df['SMA30'] = df['close'].rolling(window=30, min_periods=1).mean()
    df['STD30'] = df['close'].rolling(window=30, min_periods=1).std()
    df['BB_upper'] = df['SMA30'] + 2 * df['STD30']
    df['BB_lower'] = df['SMA30'] - 2 * df['STD30']

    # EMA 100
    df['EMA100'] = df['close'].ewm(span=100, adjust=False).mean()

    # RSI (13)
    df['RSI13'] = calculate_rsi(df['close'], period=13)

    # 3. Apply Zoom / Slicing if requested
    if zoom_start:
        zs = pd.to_datetime(zoom_start)
        if df.index.tz is not None and zs.tzinfo is None:
            zs = zs.tz_localize(df.index.tz)
        df = df[df.index >= zs]
    if zoom_end:
        ze = pd.to_datetime(zoom_end)
        if df.index.tz is not None and ze.tzinfo is None:
            ze = ze.tz_localize(df.index.tz)
        df = df[df.index <= ze]

    if len(df) == 0:
        logger.warning("Empty dataset after zoom filtering. Bypassing zoom.")
        return

    # Suppress non-trading gaps by plotting against integer x positions
    df = df.copy()
    df['x'] = np.arange(len(df))

    # 4. Multi-subplot Setup (I, II, III, IV) sharing the X-axis
    fig, (ax1, ax2, ax3, ax4) = plt.subplots(
        4, 1, figsize=(14, 12), sharex=True, 
        gridspec_kw={'height_ratios': [4, 1.0, 1.0, 0.8]}
    )

    # Dark background theme
    fig.patch.set_facecolor('#0f0f0f')
    for ax in (ax1, ax2, ax3, ax4):
        ax.set_facecolor('#1a1a1a')
        ax.tick_params(colors='#e8e8e8', labelsize=8)
        ax.grid(True, linestyle='--', alpha=0.15, color='#4a4a4a')

    # 5. SUBPLOT I: Candlesticks, moving averages, Bollinger Bands & Fibonacci Retracements
    width = 0.6
    width2 = 0.1
    up = df[df.close >= df.open]
    down = df[df.close < df.open]

    # Plot Candlesticks
    ax1.bar(up['x'], up.close - up.open, width, bottom=up.open, color='#0ecb81', edgecolor='#0ecb81')
    ax1.bar(up['x'], up.high - up.close, width2, bottom=up.close, color='#0ecb81')
    ax1.bar(up['x'], up.low - up.open, width2, bottom=up.open, color='#0ecb81')

    ax1.bar(down['x'], down.close - down.open, width, bottom=down.open, color='#f6465d', edgecolor='#f6465d')
    ax1.bar(down['x'], down.high - down.open, width2, bottom=down.open, color='#f6465d')
    ax1.bar(down['x'], down.low - down.close, width2, bottom=down.close, color='#f6465d')

    # Plot Technical Line Indicators
    ax1.plot(df['x'], df['SMA30'], label='SMA 30', color='#ffa500', linewidth=1.2)
    ax1.plot(df['x'], df['EMA100'], label='EMA 100', color='#9c27b0', linewidth=1.2)
    ax1.plot(df['x'], df['BB_upper'], label='BB Upper (30, 2)', color='#2196f3', linestyle='--', linewidth=0.9)
    ax1.plot(df['x'], df['BB_lower'], label='BB Lower (30, 2)', color='#2196f3', linestyle='--', linewidth=0.9)
    ax1.fill_between(df['x'], df['BB_lower'], df['BB_upper'], color='#808080', alpha=0.08)

    # Plot Fibonacci Retracement levels based on active (zoomed) chart swing high/low
    high_val = df['high'].max()
    low_val = df['low'].min()
    diff = high_val - low_val
    fib_levels = [0.0, 0.236, 0.382, 0.500, 0.618, 0.786, 1.0]
    fib_colors = ['#ef4444', '#f59e0b', '#f59e0b', '#10b981', '#10b981', '#3b82f6', '#ef4444']
    
    for lvl, color in zip(fib_levels, fib_colors):
        price = high_val - diff * lvl
        ax1.axhline(price, color=color, linestyle=':', alpha=0.8, linewidth=0.8)
        # Display label at the very right edge of the chart
        ax1.text(df['x'].iloc[-1], price, f" {lvl*100:.1f}% ({price:.2f})", 
                 color=color, fontsize=7, va='center', ha='left', weight='bold')

    # --- PLOT USER TRADES ---
    trades_data = data.get('trades', [])
    grouped_trades = {}

    for trade in trades_data:
        try:
            trade_dt = pd.to_datetime(trade['tradedate'])
            if df.index.tz is not None and trade_dt.tzinfo is None:
                trade_dt = trade_dt.tz_localize('UTC').tz_convert(df.index.tz)
            elif df.index.tz is None and trade_dt.tzinfo is not None:
                trade_dt = trade_dt.tz_convert(None)

            if len(df) > 0 and df.index.min() <= trade_dt <= df.index.max():
                closest_idx = df.index.get_indexer([trade_dt], method='nearest')[0]
                x_coord = int(df.iloc[closest_idx]['x'])
                
                if x_coord not in grouped_trades:
                    grouped_trades[x_coord] = []
                grouped_trades[x_coord].append(trade)
        except Exception as te:
            logger.debug(f"Failed to process trade point: {te}")

    buys_x, buys_y = [], []
    sells_x, sells_y = [], []
    mixed_x, mixed_y = [], []

    for x_coord, day_trades in grouped_trades.items():
        matching_rows = df[df['x'] == x_coord]
        default_price = float(matching_rows.iloc[0]['close']) if not matching_rows.empty else 0.0
        
        valid_prices = [float(t['price']) for t in day_trades if t.get('price') is not None]
        avg_price = sum(valid_prices) / len(valid_prices) if valid_prices else default_price
        
        buysells = [t['buysell'] for t in day_trades]
        has_buy = 'B' in buysells
        has_sell = 'S' in buysells or 'Sell' in buysells or any(x != 'B' for x in buysells)
        
        if has_buy and has_sell:
            mixed_x.append(x_coord)
            mixed_y.append(avg_price)
        elif has_buy:
            buys_x.append(x_coord)
            buys_y.append(avg_price)
        else:
            sells_x.append(x_coord)
            sells_y.append(avg_price)

    if buys_x:
        ax1.scatter(buys_x, buys_y, color='#2563eb', marker='^', s=140, edgecolor='#ffffff', linewidth=1.2, zorder=6)
    if sells_x:
        ax1.scatter(sells_x, sells_y, color='#dc2626', marker='v', s=140, edgecolor='#ffffff', linewidth=1.2, zorder=6)
    if mixed_x:
        ax1.scatter(mixed_x, mixed_y, color='#8b5cf6', marker='d', s=140, edgecolor='#ffffff', linewidth=1.2, zorder=6)

    # Tooltip Setup
    hover_points = ax1.scatter(df['x'], df['close'], s=100, alpha=0.0, picker=True)
    date_format = '%d-%b-%Y' if interval == '1d' else '%d-%b %H:%M'
    cursor = mplcursors.cursor(hover_points, hover=True)

    @cursor.connect("add")
    def on_add(sel):
        try:
            idx = int(round(sel.target[0]))
            if 0 <= idx < len(df):
                row = df.iloc[idx]
                dt = row.name.strftime(date_format)
                sel.annotation.set(text=(f"{dt}\n"
                                         f"O: {row['open']:.2f}\n"
                                         f"H: {row['high']:.2f}\n"
                                         f"L: {row['low']:.2f}\n"
                                         f"C: {row['close']:.2f}\n"
                                         f"V: {int(row['volume']):,}"))
                sel.annotation.get_bbox_patch().set(fc='#666666', alpha=0.95, edgecolor='#4a4a4a')
                sel.annotation.get_text().set_color('#ffffff')
        except Exception as e:
            logger.debug(f"Error in hover callback: {e}")

    ax1.set_ylabel('Price', fontsize=9, color='#e8e8e8')
    legend1 = ax1.legend(loc='upper left', fontsize=7, fancybox=True, shadow=False)
    legend1.get_frame().set_facecolor('#1a1a1a')
    legend1.get_frame().set_edgecolor('#4a4a4a')
    for text in legend1.get_texts():
        text.set_color('#e8e8e8')

    # 6. SUBPLOT II: RSI (13) with overbought/oversold boundaries
    ax2.plot(df['x'], df['RSI13'], label='RSI (13)', color='#e91e63', linewidth=1.2)
    ax2.axhline(70, color='#f6465d', linestyle='--', alpha=0.5, linewidth=0.8)
    ax2.axhline(30, color='#0ecb81', linestyle='--', alpha=0.5, linewidth=0.8)
    ax2.fill_between(df['x'], 30, 70, color='#e91e63', alpha=0.03)
    ax2.set_ylabel('RSI', fontsize=9, color='#e8e8e8')
    ax2.set_ylim(0, 100)
    legend2 = ax2.legend(loc='upper left', fontsize=7)
    legend2.get_frame().set_facecolor('#1a1a1a')
    legend2.get_frame().set_edgecolor('#4a4a4a')
    for text in legend2.get_texts():
        text.set_color('#e8e8e8')

    # 7. SUBPLOT III: MACD Histogram & Lines
    macd_colors = ['#0ecb81' if val >= 0 else '#f6465d' for val in df['Histogram']]
    ax3.bar(df['x'], df['Histogram'], width=width, color=macd_colors, alpha=0.4, label='MACD Hist')
    ax3.plot(df['x'], df['MACD'], label='MACD Line (12, 26)', color='#2196f3', linewidth=1.2)
    ax3.plot(df['x'], df['Signal'], label='Signal Line (9)', color='#ffa500', linewidth=1.2)
    ax3.set_ylabel('MACD', fontsize=9, color='#e8e8e8')
    legend3 = ax3.legend(loc='upper left', fontsize=7)
    legend3.get_frame().set_facecolor('#1a1a1a')
    legend3.get_frame().set_edgecolor('#4a4a4a')
    for text in legend3.get_texts():
        text.set_color('#e8e8e8')

    # 8. SUBPLOT IV: Daily Volume
    vol_colors = ['#0ecb81' if r['close'] >= r['open'] else '#f6465d' for _, r in df.iterrows()]
    ax4.bar(df['x'], df['volume'], width=width, color=vol_colors, alpha=0.6, label='Volume')
    ax4.set_ylabel('Volume', fontsize=9, color='#e8e8e8')
    legend4 = ax4.legend(loc='upper left', fontsize=7)
    legend4.get_frame().set_facecolor('#1a1a1a')
    legend4.get_frame().set_edgecolor('#4a4a4a')
    for text in legend4.get_texts():
        text.set_color('#e8e8e8')

    # 9. Format Shared X-Axis ticks (aligned to calendar months for daily interval)
    if interval == '1d':
        df_index_series = pd.Series(df.index)
        month_changed = (df_index_series.dt.month != df_index_series.dt.month.shift(1)) | \
                        (df_index_series.dt.year != df_index_series.dt.year.shift(1))
        month_changed.iloc[0] = True
        
        xticks = df['x'][month_changed.values].tolist()
        xtick_labels = [df.index[int(idx)].strftime("%b '%y") for idx in xticks]
        
        # Decimate if needed to avoid overlapping labels on long timelines
        if len(xticks) > 24:
            step = (len(xticks) + 11) // 12
            xticks = xticks[::step]
            xtick_labels = xtick_labels[::step]
    else:
        tick_interval = max(1, len(df) // 10)
        xticks = df['x'][::tick_interval].tolist()
        xtick_labels = [df.index[int(idx)].strftime('%b %d %H:%M') for idx in xticks]
    
    # Apply x-axis tick labels to Subplot IV (Volume)
    ax4.set_xticks(xticks)
    ax4.set_xticklabels(xtick_labels, rotation=35, ha='right', color='#e8e8e8')
    ax4.set_xlabel('Timeline', fontsize=9, color='#e8e8e8')

    # Force x-axis tick labels to be visible on Subplot I (Candlestick panel) as well
    ax1.tick_params(labelbottom=True)
    ax1.set_xticks(xticks)
    ax1.set_xticklabels(xtick_labels, rotation=35, ha='right', color='#e8e8e8')

    # Align boundaries precisely with integer bar positions
    ax1.set_xlim(-0.5, len(df) - 0.5)

    # Set static, explicit margins to align precisely with the frontend hover HUD
    fig.subplots_adjust(left=0.06, right=0.94, top=0.95, bottom=0.08, hspace=0.15)

    # Shift subplots II, III, IV down to create more spacing between I and II only
    try:
        pos2 = ax2.get_position()
        pos3 = ax3.get_position()
        pos4 = ax4.get_position()
        offset = 0.03 # Shifts the bottom three subplots down by 36 pixels (on a 12-inch/1200px figure)
        ax2.set_position([pos2.x0, pos2.y0 - offset, pos2.width, pos2.height])
        ax3.set_position([pos3.x0, pos3.y0 - offset, pos3.width, pos3.height])
        ax4.set_position([pos4.x0, pos4.y0 - offset, pos4.width, pos4.height])
    except Exception as e:
        logger.debug(f"Failed to adjust individual subplot positions: {e}")

    # Save and cleanup
    save_path = output_path or f'{symbol}_macd_candlestick.png'
    plt.savefig(save_path)
    plt.close(fig)

def marketclose_chart(data: Dict[str, Any], output_path: Optional[str] = None) -> None:
    # Extract datetime and close values from the API response
    datetimes = [item["date"] if "date" in item else item["datetime"] for item in data["values"]]
    closes = [float(item["close"]) for item in data["values"]]

    # Convert datetime strings to pandas datetime objects
    datetimes = pd.to_datetime(datetimes)

    # Now plot with proper date handling
    plt.figure(figsize=(12, 6))
    df = pd.DataFrame({'close': closes}, index=datetimes)
    plt.plot(df.index, df['close'], linewidth=2, label='Close Price')
    for m in (3, 6, 9):
        ma = df['close'].rolling(window=m).mean()
        plt.plot(df.index, ma, label=f'{m}-period MA', linestyle='--')
    plt.gca().xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))
    plt.xticks(rotation=45)
    plt.xlabel('Date')
    plt.ylabel('Close Price')
    plt.title('Stock Price Over Time')
    plt.grid(True, alpha=0.3)
    plt.legend()
    plt.tight_layout()
    save_path = output_path or 'marketclose.png'
    plt.savefig(save_path)
    plt.close('all')

def daily_chart(data: Dict[str, Any], output_path: Optional[str] = None) -> None:
    # Extract datetime, open, high, low, close values from the API response
    datetimes = [item["date"] if "date" in item else item["datetime"] for item in data["values"]]
    opens = [float(item["open"]) for item in data["values"]]
    highs = [float(item["high"]) for item in data["values"]]
    lows = [float(item["low"]) for item in data["values"]]
    closes = [float(item["close"]) for item in data["values"]]
    volumes = [float(item["volume"]) for item in data["values"]]
    
    # Convert datetime strings to pandas datetime objects
    datetimes = pd.to_datetime(datetimes)

    # Create a DataFrame for mplfinance
    df = pd.DataFrame({
        'Open': opens,
        'High': highs,
        'Low': lows,
        'Close': closes,
        'Volume': volumes
    }, index=datetimes)
    df = df.sort_index()  # Ensure the DataFrame is sorted by datetime
    save_path = output_path or 'daily.png'
    mpf.plot(df, type='ohlc', volume=True, mav=(3,20,50), savefig=save_path)
    plt.close('all')

if __name__ == '__main__':
    import argparse
    import sys
    
    parser = argparse.ArgumentParser(description="AlphaInsight Plotting Tool")
    parser.add_argument("chart_type", choices=["candlestick", "marketclose", "daily"], help="Type of chart to generate")
    parser.add_argument("json_file", help="Path to EOD/Tick dataset JSON file")
    parser.add_argument("output_image", help="Path to save output chart image")
    parser.add_argument("--zoom-start", help="Start date for zooming (YYYY-MM-DD)")
    parser.add_argument("--zoom-end", help="End date for zooming (YYYY-MM-DD)")
    
    args = parser.parse_args()
    
    # Set non-interactive backend for matplotlib
    plt.switch_backend('Agg')
    
    try:
        with open(args.json_file, 'r') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Failed to load JSON file {args.json_file}: {e}")
        sys.exit(1)
        
    if args.chart_type == 'candlestick':
        candlestick_chart(data, args.output_image, args.zoom_start, args.zoom_end)
    elif args.chart_type == 'marketclose':
        marketclose_chart(data, args.output_image)
    elif args.chart_type == 'daily':
        daily_chart(data, args.output_image)
    else:
        print(f"Unknown chart type: {args.chart_type}")
        sys.exit(1)
        
    print("Success")
