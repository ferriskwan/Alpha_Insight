from pathlib import Path
import os
import logging
import math
import json
import csv
from typing import Dict, Any, Optional, Union, List
import psycopg2
import psycopg2.extensions
import psycopg2.pool
from dotenv import load_dotenv

load_dotenv()

parentDir = os.getcwd()

# inherit logging configuration from main.py
logger = logging.getLogger(__name__)
logger.debug(f"[ProcessData.py]: Parent directory: {parentDir}")


def _get_db_config() -> Dict[str, Any]:
    """Build PostgreSQL connection parameters from environment variables."""
    public_ip = os.getenv("DB_PUBLIC_IP") or os.getenv("DB_HOST")
    if not public_ip:
        raise RuntimeError("DB_PUBLIC_IP or DB_HOST must be set")

    if (
        ":" in public_ip
        and public_ip.count(":") >= 2
        and not public_ip.startswith("/cloudsql/")
        and not os.getenv("DB_PUBLIC_IP")
    ):
        raise RuntimeError(
            "DB_HOST appears to be a Cloud SQL instance connection name. Set DB_PUBLIC_IP to the public IP address."
        )

    db_name = os.getenv("DB_NAME")
    db_user = os.getenv("DB_USER")
    db_password = os.getenv("DB_PASSWORD")
    db_port = os.getenv("DB_PORT")

    if not db_name or not db_user or not db_password or not db_port:
        raise RuntimeError("DB_NAME, DB_USER, DB_PASSWORD, and DB_PORT must be configured")

    db_schema = os.getenv("DB_SCHEMA", "public")

    return {
        "host": public_ip,
        "port": int(db_port),
        "dbname": db_name,
        "user": db_user,
        "password": db_password,
        "sslmode": os.getenv("DB_SSLMODE", "require"),
        "options": f"-c search_path={db_schema}",
    }


def _json_serialize_helper(obj):
    """JSON serializer helper for date/datetime objects."""
    from datetime import datetime, date
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")


def connect_clover() -> psycopg2.extensions.connection:
    """Return a PostgreSQL connection to the Clover database."""
    logger.debug("[ProcessData.py].connect_clover(): connect to PostgreSQL")
    return psycopg2.connect(**_get_db_config())


_db_pool = None


def init_pool(minconn: int = 1, maxconn: int = 20):
    """Initialize a ThreadedConnectionPool for database connections."""
    global _db_pool
    if _db_pool is None:
        try:
            _db_pool = psycopg2.pool.ThreadedConnectionPool(minconn, maxconn, **_get_db_config())
            logger.info("[ProcessData.py]: Database connection pool initialized successfully")
        except Exception as e:
            logger.error(f"[ProcessData.py]: Failed to initialize database connection pool: {e}", exc_info=True)
            raise


def close_pool():
    """Safely close all pooled connections."""
    global _db_pool
    if _db_pool is not None:
        try:
            _db_pool.closeall()
            logger.info("[ProcessData.py]: Database connection pool closed")
        except Exception as e:
            logger.error(f"[ProcessData.py]: Error closing connection pool: {e}", exc_info=True)
        finally:
            _db_pool = None


def get_connection() -> psycopg2.extensions.connection:
    """Retrieve a connection from the pool, or fallback to a direct connection."""
    global _db_pool
    if _db_pool is None:
        logger.debug("[ProcessData.py]: No pool initialized; fallback to direct connect_clover()")
        return connect_clover()
    return _db_pool.getconn()


def put_connection(conn: psycopg2.extensions.connection, close: bool = False):
    """Return a connection to the pool, or close/discard it if requested or closed."""
    global _db_pool
    if conn:
        try:
            if conn.closed:
                close = True
            elif not close:
                conn.rollback()
        except Exception as e:
            logger.warning(f"[ProcessData.py]: Error during connection reset: {e}")
            close = True

        if _db_pool is not None:
            try:
                _db_pool.putconn(conn, close=close)
            except Exception as e:
                logger.error(f"[ProcessData.py]: Error returning connection to pool: {e}", exc_info=True)
        else:
            try:
                conn.close()
            except Exception:
                pass

# Inserts from a json or dict data structure into the TickData table in the PostgreSQL database
def insert_Tickdata(connection: psycopg2.extensions.connection, data: Dict[str, Any]) -> int:
    if not data or 'values' not in data:
        logger.warning("[ProcessData.py].insert_tickdata(): No tick data to insert")
        return 0

    symbol = data.get('meta', {}).get('symbol')
    interval = data.get('meta', {}).get('interval')
    values = []

    for row in data['values']:
        timestamp = row.get('datetime') or row.get('Datetime')
        try:
            open_price = float(row.get('open', row.get('Open', 0)))
            high_price = float(row.get('high', row.get('High', 0)))
            low_price = float(row.get('low', row.get('Low', 0)))
            close_price = float(row.get('close', row.get('Close', 0)))
            volume = float(row.get('volume', row.get('Volume', 0)))
        except (ValueError, TypeError) as exc:
            logger.warning('Skipping invalid row %s: %s', row, exc)
            continue
        logger.debug("[ProcessData.py].insert_tickdata(): Inserting row for symbol %s: %s", symbol, row)
        values.append((symbol, interval, timestamp, open_price, high_price, low_price, close_price, volume))

    if not values:
        logger.warning("[ProcessData.py].insert_tickdata(): No valid tick rows were found in data1")
        return 0

    with connection.cursor() as cursor:
        # delete existing rows for the same symbol and timestamp to avoid duplicates (idempotent insert)
        min_timestamp = min(row[2] for row in values)
        cursor.execute("DELETE FROM TickData WHERE Symbol = %s AND Interval = %s AND Timestamp >= %s", (symbol, interval, min_timestamp))

        cursor.executemany(
            "INSERT INTO TickData (Symbol, Interval, Timestamp, Open, High, Low, Close, Volume, UpdateTimestamp) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)",
            values
        )
        connection.commit()
        rowcount = cursor.rowcount
    logger.debug("[ProcessData.py].insert_tickdata(): Inserted %d rows for symbol %s", rowcount, symbol)
    return rowcount

def insert_EODData(connection: psycopg2.extensions.connection, data: Dict[str, Any]) -> int:
    if not data or 'values' not in data:
        logger.warning("[ProcessData.py].insert_EODData(): No EOD data to insert")
        return 0

    symbol = data.get('meta', {}).get('symbol')
    interval = data.get('meta', {}).get('interval')
    values = []

    for row in data['values']:
        timestamp = row.get('datetime') or row.get('Datetime')
        try:
            open_price = float(row.get('open', row.get('Open', 0)))
            high_price = float(row.get('high', row.get('High', 0)))
            low_price = float(row.get('low', row.get('Low', 0)))
            close_price = float(row.get('close', row.get('Close', 0)))
            volume = float(row.get('volume', row.get('Volume', 0)))
        except (ValueError, TypeError) as exc:
            logger.warning("[ProcessData.py].insert_EODData(): Skipping invalid row %s: %s", row, exc)
            continue

        if math.isnan(close_price) or close_price <= 0:
            logger.warning(
                "[ProcessData.py].insert_EODData(): Skipping non-positive/NaN close for %s on %s: %s",
                symbol,
                timestamp,
                close_price,
            )
            continue
        logger.debug("[ProcessData.py].insert_EODData(): Inserting row for symbol %s: %s", symbol, row)
        values.append((symbol, timestamp, open_price, high_price, low_price, close_price, volume))

    if not values:
        logger.warning("[ProcessData.py].insert_EODData(): No valid EOD rows were found in data")
        return 0

    with connection.cursor() as cursor:
        # delete existing rows for the same symbol and date to avoid duplicates (idempotent insert)
        min_date = min(row[1] for row in values)
        cursor.execute("DELETE FROM EODData WHERE Symbol = %s AND Date >= %s", (symbol, min_date))
        
        cursor.executemany(
            "INSERT INTO EODData (Symbol, Date, Open, High, Low, Close, Volume, UpdateTimestamp) VALUES (%s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)",
            values
        )
        connection.commit()
        rowcount = cursor.rowcount
    logger.debug("[ProcessData.py].insert_EODData(): Inserted %d rows for symbol %s", rowcount, symbol)
    return rowcount

def insert_exchange_rate(connection: psycopg2.extensions.connection, data: Dict[str, Any]) -> int:
    """
    Inserts a list of Exchange Rate dictionary items (date, currency, base_currency, rate) into the exchange_rate table.
    """
    logger.debug(f"[ProcessData.py].insert_exchange_rate(): Inserting {len(data)} rows into exchange_rate")
    with connection.cursor() as cursor:
        for item in data:
            date_val = item.get('date')
            currency = item.get('currency')
            base_currency = item.get('base_currency')
            rate = item.get('rate')
            cursor.execute(
                """
                INSERT INTO exchange_rate (date, currency, base_currency, rate, updatetimestamp) 
                VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
                ON CONFLICT (date, currency, base_currency) 
                DO UPDATE SET rate = EXCLUDED.rate, updatetimestamp = CURRENT_TIMESTAMP
                """,
                (date_val, currency, base_currency, rate)
            )
        connection.commit()
        return len(data)


def TickData_generate(
    connection: psycopg2.extensions.connection, 
    symbol: str, 
    user_id: int,
    output_format: str = "dict", 
    csv_path: Optional[str] = None,
    days_to_extract: Optional[int] = None
) -> Optional[Union[Dict[str, Any], str]]:
    """
    Generates a dictionary, JSON, or CSV file containing tick data and metadata for charting.
    Note: Does not commit transaction (read-only query).
    
    Args:
        connection: psycopg2 connection to the PostgreSQL database
        symbol: The stock symbol to retrieve data for
        user_id: Active user ID for tenant isolation
        output_format: Desired output format: "dict" (Python dict), "json" (JSON string), or "csv" (CSV file path)
        csv_path: Optional custom file path where the CSV data should be saved if output_format="csv"
        
    Returns:
        - If output_format="dict": A dictionary with "meta" and "values" keys.
        - If output_format="json": A serialized JSON string of the dictionary.
        - If output_format="csv": The file path string where the CSV data was saved.
        - Returns None if the symbol is not in the WatchList or if no TickData is found.
    """
    logger.debug("[ProcessData.py].TickData_generate(): Generating tick data for symbol %s in format %s", symbol, output_format)
    
    if days_to_extract is None:
        days_to_extract = 7
        
    with connection.cursor() as cursor:
        # Query WatchList to get Symbol and WatchList with tenant isolation
        cursor.execute("SELECT Symbol, WatchListName, Name, Timezone FROM WatchList WHERE Symbol = %s AND user_id = %s", (symbol, user_id))
        watchlist_row = cursor.fetchone()
        
        if not watchlist_row:
            logger.warning("[ProcessData.py].TickData_generate(): No WatchList entry found for symbol %s and user %d", symbol, user_id)
            return None
        
        watchlist_symbol, watchlist_name, name, timezone = watchlist_row
        
        # Query TickData to get Interval and OHLCV data
        cursor.execute(
            """
            SELECT Interval, Timestamp, Open, High, Low, Close, Volume 
            FROM TickData 
            WHERE Symbol = %s 
              AND Timestamp >= (SELECT CAST(MAX(Timestamp) AS date) - INTERVAL '1 day' * %s FROM TickData WHERE Symbol = %s)
            ORDER BY Timestamp
            """,
            (symbol, days_to_extract, symbol)
        )
        tick_rows = cursor.fetchall()
    
    if not tick_rows:
        logger.warning("[ProcessData.py].TickData_generate(): No TickData found for symbol %s", symbol)
        return None
    
    # Get interval from first row (should be same for all)
    interval = tick_rows[0][0]
    
    # Build the values list with tick data sorted by timestamp (normalized to lowercase keys)
    values = []
    for row in tick_rows:
        values.append({
            'timestamp': row[1],
            'open': row[2],
            'high': row[3],
            'low': row[4],
            'close': row[5],
            'volume': row[6]
        })
    
    # Build the meta dictionary (normalized to lowercase keys)
    meta = {
        'symbol': watchlist_symbol,
        'watchlist': watchlist_name,
        'interval': interval,
        'name': name,
        'timezone': timezone
    }
    
    # Build the final data dictionary
    data = {
        'meta': meta,
        'values': values
    }
    
    logger.debug("[ProcessData.py].TickData_generate(): Generated data for symbol %s with %d tick records", symbol, len(values))
    
    # Return formatted output based on requested format
    if output_format == "json":
        # Serialize python dictionary containing datetime objects to JSON
        return json.dumps(data, default=_json_serialize_helper, indent=4)
        
    elif output_format == "csv":
        # Save to default folder (ProcessedData/) if no path is specified
        if not csv_path:
            os.makedirs("ProcessedData", exist_ok=True)
            csv_path = os.path.join("ProcessedData", f"{symbol}_tick.csv")
        else:
            dir_name = os.path.dirname(csv_path)
            if dir_name:
                os.makedirs(dir_name, exist_ok=True)
                
        # Write tabular values to CSV
        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            writer.writeheader()
            for row in values:
                writer.writerow({
                    'timestamp': row['timestamp'].isoformat() if hasattr(row['timestamp'], 'isoformat') else str(row['timestamp']),
                    'open': row['open'],
                    'high': row['high'],
                    'low': row['low'],
                    'close': row['close'],
                    'volume': row['volume']
                })
        logger.debug("[ProcessData.py].TickData_generate(): CSV file saved at %s", csv_path)
        return csv_path
        
    else:
        # Default: return native python dictionary
        return data


def EODData_generate(
    connection: psycopg2.extensions.connection, 
    symbol: str, 
    user_id: int,
    output_format: str = "dict", 
    csv_path: Optional[str] = None,
    days_to_extract: Optional[int] = None
) -> Optional[Union[Dict[str, Any], str]]:
    """
    Generates a dictionary, JSON, or CSV file containing end-of-day market data and metadata for charting.
    Note: Does not commit transaction (read-only query).
    
    Args:
        connection: psycopg2 connection to the PostgreSQL database
        symbol: The stock symbol to retrieve data for
        user_id: Active user ID for tenant isolation
        output_format: Desired output format: "dict" (Python dict), "json" (JSON string), or "csv" (CSV file path)
        csv_path: Optional custom file path where the CSV data should be saved if output_format="csv"
        
    Returns:
        - If output_format="dict": A dictionary with "meta" and "values" keys.
        - If output_format="json": A serialized JSON string of the dictionary.
        - If output_format="csv": The file path string where the CSV data was saved.
        - Returns None if the symbol is not in the WatchList or if no EODData is found.
    """
    logger.debug("[ProcessData.py].EODData_generate(): Generating EOD data for symbol %s in format %s", symbol, output_format)
    
    if days_to_extract is None:
        days_to_extract = 730
        
    with connection.cursor() as cursor:
        # Query WatchList to get Symbol and WatchList with tenant isolation
        cursor.execute("SELECT Symbol, WatchListName, Name, Timezone FROM WatchList WHERE Symbol = %s AND user_id = %s", (symbol, user_id))
        watchlist_row = cursor.fetchone()
        
        if not watchlist_row:
            logger.warning("[ProcessData.py].EODData_generate(): No WatchList entry found for symbol %s and user %d", symbol, user_id)
            return None
        
        watchlist_symbol, watchlist_name, name, timezone = watchlist_row
        
        # Query EODData to get market close data
        cursor.execute(
            """
            SELECT Date, Date::timestamp as Timestamp, Open, High, Low, Close, Volume 
            FROM EODData 
            WHERE Symbol = %s 
              AND Date >= (SELECT CAST(MAX(Date::timestamp) AS date) - INTERVAL '1 day' * %s FROM EODData WHERE Symbol = %s)
            ORDER BY Date
            """,
            (symbol, days_to_extract, symbol)
        )
        eod_rows = cursor.fetchall()
    
    if not eod_rows:
        logger.warning("[ProcessData.py].EODData_generate(): No EODData found for symbol %s", symbol)
        return None
    
    # Build the values list with EOD data sorted by date (normalized to lowercase keys)
    values = []
    for row in eod_rows:
        values.append({
            'date': row[0],
            'timestamp': row[1],
            'open': row[2],
            'high': row[3],
            'low': row[4],
            'close': row[5],
            'volume': row[6]
        })
    
    # Build the meta dictionary with hardcoded interval '1d' (normalized to lowercase keys)
    meta = {
        'symbol': watchlist_symbol,
        'watchlist': watchlist_name,
        'interval': '1d',
        'name': name,
        'timezone': timezone
    }
    
    # Build the final data dictionary
    data = {
        'meta': meta,
        'values': values
    }
    
    logger.debug("[ProcessData.py].EODData_generate(): Generated data for symbol %s with %d EOD records", symbol, len(values))
    
    # Return formatted output based on requested format
    if output_format == "json":
        # Serialize python dictionary containing date/datetime objects to JSON
        return json.dumps(data, default=_json_serialize_helper, indent=4)
        
    elif output_format == "csv":
        # Save to default folder (ProcessedData/) if no path is specified
        if not csv_path:
            os.makedirs("ProcessedData", exist_ok=True)
            csv_path = os.path.join("ProcessedData", f"{symbol}_eod.csv")
        else:
            dir_name = os.path.dirname(csv_path)
            if dir_name:
                os.makedirs(dir_name, exist_ok=True)
                
        # Write tabular values to CSV
        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=['date', 'timestamp', 'open', 'high', 'low', 'close', 'volume'])
            writer.writeheader()
            for row in values:
                writer.writerow({
                    'date': row['date'].isoformat() if hasattr(row['date'], 'isoformat') else str(row['date']),
                    'timestamp': row['timestamp'].isoformat() if hasattr(row['timestamp'], 'isoformat') else str(row['timestamp']),
                    'open': row['open'],
                    'high': row['high'],
                    'low': row['low'],
                    'close': row['close'],
                    'volume': row['volume']
                })
        logger.debug("[ProcessData.py].EODData_generate(): CSV file saved at %s", csv_path)
        return csv_path
        
    else:
        # Default: return native python dictionary
        return data


# ==========================================
# WatchList & Trade Database Operations
# ==========================================

def get_watchlist(
    connection: psycopg2.extensions.connection, 
    user_id: int,
    watchlistname: Optional[str] = None, 
    symbol: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Retrieve watchlist entries for a user, optionally filtered by watchlistname and symbol.
    Note: Does not commit transaction.
    """
    logger.debug(f"[ProcessData.py].get_watchlist(): Querying watchlist records for user {user_id}")
    with connection.cursor() as cursor:
        query = "SELECT watchlistname, symbol, name, timezone, currency, updatetimestamp FROM watchlist WHERE user_id = %s"
        params = [user_id]
        
        if watchlistname:
            query += " AND watchlistname = %s"
            params.append(watchlistname)
        if symbol:
            query += " AND symbol = %s"
            params.append(symbol)
            
        query += " ORDER BY watchlistname, symbol"
        cursor.execute(query, params)
        
        results = []
        for row in cursor.fetchall():
            results.append({
                "watchlistname": row[0],
                "symbol": row[1],
                "name": row[2],
                "timezone": row[3],
                "currency": row[4] or "USD",
                "updatetimestamp": row[5]
            })
        return results


def insert_watchlist(
    connection: psycopg2.extensions.connection, 
    user_id: int,
    watchlistname: str, 
    symbol: str, 
    name: str, 
    timezone: str,
    currency: str
) -> Dict[str, Any]:
    """
    Insert a new stock entry into the watchlist for a user.
    Note: Does not commit transaction; caller must call commit().
    """
    logger.debug(f"[ProcessData.py].insert_watchlist(): Inserting symbol {symbol} into watchlist {watchlistname} for user {user_id}")
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO watchlist (user_id, watchlistname, symbol, name, timezone, currency, updatetimestamp)
            VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
            RETURNING watchlistname, symbol, name, timezone, currency, updatetimestamp
            """,
            (user_id, watchlistname, symbol, name, timezone, currency)
        )
        row = cursor.fetchone()
        return {
            "watchlistname": row[0],
            "symbol": row[1],
            "name": row[2],
            "timezone": row[3],
            "currency": row[4] or "USD",
            "updatetimestamp": row[5]
        }


def update_watchlist(
    connection: psycopg2.extensions.connection, 
    user_id: int,
    watchlistname: str, 
    symbol: str, 
    name: Optional[str] = None, 
    timezone: Optional[str] = None,
    currency: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Update descriptive fields of a watchlist entry for a user.
    Note: Does not commit transaction; caller must call commit().
    """
    logger.debug(f"[ProcessData.py].update_watchlist(): Updating watchlist {watchlistname}, symbol {symbol} for user {user_id}")
    
    fields = []
    params = []
    if name is not None:
        fields.append("name = %s")
        params.append(name)
    if timezone is not None:
        fields.append("timezone = %s")
        params.append(timezone)
    if currency is not None:
        fields.append("currency = %s")
        params.append(currency)
        
    if not fields:
        res = get_watchlist(connection, user_id, watchlistname, symbol)
        return res[0] if res else None
        
    params.extend([watchlistname, symbol, user_id])
    query = f"""
        UPDATE watchlist 
        SET {', '.join(fields)}, updatetimestamp = CURRENT_TIMESTAMP
        WHERE watchlistname = %s AND symbol = %s AND user_id = %s
        RETURNING watchlistname, symbol, name, timezone, currency, updatetimestamp
    """
    
    with connection.cursor() as cursor:
        cursor.execute(query, params)
        row = cursor.fetchone()
        if row:
            return {
                "watchlistname": row[0],
                "symbol": row[1],
                "name": row[2],
                "timezone": row[3],
                "currency": row[4] or "USD",
                "updatetimestamp": row[5]
            }
    return None


def delete_watchlist(
    connection: psycopg2.extensions.connection, 
    user_id: int,
    watchlistname: str, 
    symbol: str
) -> bool:
    """
    Delete a watchlist entry by composite key for a user.
    Note: Does not commit transaction; caller must call commit().
    """
    logger.debug(f"[ProcessData.py].delete_watchlist(): Deleting watchlist {watchlistname}, symbol {symbol} for user {user_id}")
    with connection.cursor() as cursor:
        cursor.execute(
            "DELETE FROM watchlist WHERE watchlistname = %s AND symbol = %s AND user_id = %s",
            (watchlistname, symbol, user_id)
        )
        return cursor.rowcount > 0


def watchlist_symbol_exists(
    connection: psycopg2.extensions.connection, 
    user_id: int,
    symbol: str
) -> bool:
    """
    Check if a stock symbol exists in a user's watchlist.
    Note: Does not commit transaction.
    """
    logger.debug(f"[ProcessData.py].watchlist_symbol_exists(): Checking symbol {symbol} for user {user_id}")
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT 1 FROM watchlist WHERE symbol = %s AND user_id = %s LIMIT 1",
            (symbol, user_id)
        )
        return cursor.fetchone() is not None


def get_trades(
    connection: psycopg2.extensions.connection, 
    user_id: int,
    symbol: Optional[str] = None, 
    buysell: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Retrieve trades for a user, optionally filtered by symbol and buysell.
    Note: Does not commit transaction.
    """
    logger.debug(f"[ProcessData.py].get_trades(): Querying trade records for user {user_id}")
    with connection.cursor() as cursor:
        query = "SELECT id, symbol, buysell, tradedate, investment, price, quantity, remarks, updatetimestamp FROM trade WHERE user_id = %s AND price IS NOT NULL AND quantity IS NOT NULL AND tradedate IS NOT NULL AND buysell IS NOT NULL"
        params = [user_id]
        
        if symbol:
            query += " AND symbol = %s"
            params.append(symbol)
        if buysell:
            query += " AND buysell = %s"
            params.append(buysell)
            
        query += " ORDER BY tradedate DESC, id DESC"
        cursor.execute(query, params)
        
        results = []
        for row in cursor.fetchall():
            results.append({
                "id": row[0],
                "symbol": row[1],
                "buysell": row[2],
                "tradedate": row[3],
                "investment": row[4],
                "price": row[5],
                "quantity": row[6],
                "remarks": row[7],
                "updatetimestamp": row[8]
            })
        return results


def insert_trade(
    connection: psycopg2.extensions.connection,
    user_id: int,
    symbol: str,
    buysell: str,
    tradedate: Any,
    investment: bool,
    price: Optional[float],
    quantity: float,
    remarks: Optional[str]
) -> Dict[str, Any]:
    """
    Insert a new trade log (generating trade ID) for a user.
    Note: Does not commit transaction; caller must call commit().
    """
    logger.debug(f"[ProcessData.py].insert_trade(): Logging trade for symbol {symbol} for user {user_id}")
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO trade (user_id, symbol, buysell, tradedate, investment, price, quantity, remarks, updatetimestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
            RETURNING id, symbol, buysell, tradedate, investment, price, quantity, remarks, updatetimestamp
            """,
            (user_id, symbol, buysell, tradedate, investment, price, quantity, remarks)
        )
        row = cursor.fetchone()
        return {
            "id": row[0],
            "symbol": row[1],
            "buysell": row[2],
            "tradedate": row[3],
            "investment": row[4],
            "price": row[5],
            "quantity": row[6],
            "remarks": row[7],
            "updatetimestamp": row[8]
        }


def update_trade(
    connection: psycopg2.extensions.connection,
    user_id: int,
    trade_id: int,
    symbol: Optional[str] = None,
    buysell: Optional[str] = None,
    tradedate: Optional[Any] = None,
    investment: Optional[bool] = None,
    price: Optional[float] = None,
    quantity: Optional[float] = None,
    remarks: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Update existing trade fields for a user.
    Note: Does not commit transaction; caller must call commit().
    """
    logger.debug(f"[ProcessData.py].update_trade(): Updating trade ID {trade_id} for user {user_id}")
    
    fields = []
    params = []
    if symbol is not None:
        fields.append("symbol = %s")
        params.append(symbol)
    if buysell is not None:
        fields.append("buysell = %s")
        params.append(buysell)
    if tradedate is not None:
        fields.append("tradedate = %s")
        params.append(tradedate)
    if investment is not None:
        fields.append("investment = %s")
        params.append(investment)
    if price is not None:
        fields.append("price = %s")
        params.append(price)
    if quantity is not None:
        fields.append("quantity = %s")
        params.append(quantity)
    if remarks is not None:
        fields.append("remarks = %s")
        params.append(remarks)
        
    with connection.cursor() as cursor:
        if not fields:
            cursor.execute("SELECT id, symbol, buysell, tradedate, investment, price, quantity, remarks, updatetimestamp FROM trade WHERE id = %s AND user_id = %s", (trade_id, user_id))
            row = cursor.fetchone()
            if row:
                return {
                    "id": row[0], "symbol": row[1], "buysell": row[2], "tradedate": row[3],
                    "investment": row[4], "price": row[5], "quantity": row[6], "remarks": row[7], "updatetimestamp": row[8]
                }
            return None
            
        params.extend([trade_id, user_id])
        query = f"""
            UPDATE trade 
            SET {', '.join(fields)}, updatetimestamp = CURRENT_TIMESTAMP
            WHERE id = %s AND user_id = %s
            RETURNING id, symbol, buysell, tradedate, investment, price, quantity, remarks, updatetimestamp
        """
        
        cursor.execute(query, params)
        row = cursor.fetchone()
        if row:
            return {
                "id": row[0],
                "symbol": row[1],
                "buysell": row[2],
                "tradedate": row[3],
                "investment": row[4],
                "price": row[5],
                "quantity": row[6],
                "remarks": row[7],
                "updatetimestamp": row[8]
            }
    return None


def delete_trade(
    connection: psycopg2.extensions.connection, 
    user_id: int,
    trade_id: int
) -> bool:
    """
    Delete a trade entry by ID for a user.
    Note: Does not commit transaction; caller must call commit().
    """
    logger.debug(f"[ProcessData.py].delete_trade(): Deleting trade ID {trade_id} for user {user_id}")
    with connection.cursor() as cursor:
        cursor.execute("DELETE FROM trade WHERE id = %s AND user_id = %s", (trade_id, user_id))
        return cursor.rowcount > 0


# ==========================================
# Portfolio Positions & Capital Operations
# ==========================================

def get_positions(connection: psycopg2.extensions.connection, user_id: int) -> List[Dict[str, Any]]:
    """
    Retrieve open positions with current quantity, average cost, and EOD valuation for a user.
    Note: Does not commit transaction.
    """
    logger.debug(f"[ProcessData.py].get_positions(): Querying positions for user_id={user_id}")
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT tradedate, symbol, investment, avgprice, quantity, eodprice, updatetimestamp
            FROM position
            WHERE user_id = %s
            ORDER BY symbol, tradedate DESC
            """,
            (user_id,)
        )
        results = []
        for row in cursor.fetchall():
            results.append({
                "tradedate": row[0].isoformat() if hasattr(row[0], 'isoformat') else str(row[0]),
                "symbol": row[1],
                "investment": row[2],
                "avgprice": row[3],
                "quantity": row[4],
                "eodprice": row[5],
                "updatetimestamp": row[6].isoformat() if hasattr(row[6], 'isoformat') else str(row[6])
            })
        return results


def get_capital(connection: psycopg2.extensions.connection, user_id: int) -> List[Dict[str, Any]]:
    """
    Retrieve capital movements for cash balance calculation for a user.
    Note: Does not commit transaction.
    """
    logger.debug(f"[ProcessData.py].get_capital(): Querying capital movements for user_id={user_id}")
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id, broker, transtype, accounttype, amount, date, currency, remarks, updatetimestamp
            FROM capital
            WHERE user_id = %s
            ORDER BY date DESC, id DESC
            """,
            (user_id,)
        )
        results = []
        for row in cursor.fetchall():
            results.append({
                "id": row[0],
                "broker": row[1],
                "transtype": row[2],
                "accounttype": row[3],
                "amount": float(row[4]) if row[4] is not None else 0.0,
                "date": row[5].isoformat() if hasattr(row[5], 'isoformat') else str(row[5]),
                "currency": row[6],
                "remarks": row[7],
                "updatetimestamp": row[8].isoformat() if hasattr(row[8], 'isoformat') else str(row[8])
            })
        return results


def insert_capital(
    connection: psycopg2.extensions.connection, 
    user_id: int, 
    broker: str, 
    transtype: str, 
    accounttype: str, 
    amount: float, 
    date_val: Any, 
    currency: str, 
    remarks: str
) -> Dict[str, Any]:
    """
    Insert a new capital record (generating capital ID) for a user.
    Note: Does not commit transaction; caller must call commit().
    """
    logger.debug(f"[ProcessData.py].insert_capital(): Logging capital for user {user_id}")
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO capital (user_id, broker, transtype, accounttype, amount, date, currency, remarks, updatetimestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
            RETURNING id, broker, transtype, accounttype, amount, date, currency, remarks, updatetimestamp
            """,
            (user_id, broker, transtype, accounttype, amount, date_val, currency, remarks)
        )
        row = cursor.fetchone()
        return {
            "id": row[0], "broker": row[1], "transtype": row[2], "accounttype": row[3],
            "amount": float(row[4]) if row[4] is not None else 0.0,
            "date": row[5].isoformat() if hasattr(row[5], 'isoformat') else str(row[5]),
            "currency": row[6], "remarks": row[7], "updatetimestamp": row[8].isoformat() if hasattr(row[8], 'isoformat') else str(row[8])
        }


def update_capital(
    connection: psycopg2.extensions.connection, 
    user_id: int, 
    capital_id: int, 
    broker: Optional[str] = None, 
    transtype: Optional[str] = None, 
    accounttype: Optional[str] = None, 
    amount: Optional[float] = None, 
    date_val: Optional[Any] = None, 
    currency: Optional[str] = None, 
    remarks: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Update existing capital fields for a user.
    Note: Does not commit transaction; caller must call commit().
    """
    logger.debug(f"[ProcessData.py].update_capital(): Updating capital ID {capital_id} for user {user_id}")
    
    fields = []
    params = []
    if broker is not None:
        fields.append("broker = %s")
        params.append(broker)
    if transtype is not None:
        fields.append("transtype = %s")
        params.append(transtype)
    if accounttype is not None:
        fields.append("accounttype = %s")
        params.append(accounttype)
    if amount is not None:
        fields.append("amount = %s")
        params.append(amount)
    if date_val is not None:
        fields.append("date = %s")
        params.append(date_val)
    if currency is not None:
        fields.append("currency = %s")
        params.append(currency)
    if remarks is not None:
        fields.append("remarks = %s")
        params.append(remarks)
        
    with connection.cursor() as cursor:
        if not fields:
            cursor.execute("SELECT id, broker, transtype, accounttype, amount, date, currency, remarks, updatetimestamp FROM capital WHERE id = %s AND user_id = %s", (capital_id, user_id))
            row = cursor.fetchone()
            if row:
                return {
                    "id": row[0], "broker": row[1], "transtype": row[2], "accounttype": row[3],
                    "amount": float(row[4]) if row[4] is not None else 0.0,
                    "date": row[5].isoformat() if hasattr(row[5], 'isoformat') else str(row[5]),
                    "currency": row[6], "remarks": row[7], "updatetimestamp": row[8].isoformat() if hasattr(row[8], 'isoformat') else str(row[8])
                }
            return None
            
        params.extend([capital_id, user_id])
        query = f"""
            UPDATE capital 
            SET {', '.join(fields)}, updatetimestamp = CURRENT_TIMESTAMP
            WHERE id = %s AND user_id = %s
            RETURNING id, broker, transtype, accounttype, amount, date, currency, remarks, updatetimestamp
        """
        cursor.execute(query, params)
        row = cursor.fetchone()
        if row:
            return {
                "id": row[0], "broker": row[1], "transtype": row[2], "accounttype": row[3],
                "amount": float(row[4]) if row[4] is not None else 0.0,
                "date": row[5].isoformat() if hasattr(row[5], 'isoformat') else str(row[5]),
                "currency": row[6], "remarks": row[7], "updatetimestamp": row[8].isoformat() if hasattr(row[8], 'isoformat') else str(row[8])
            }
    return None


def delete_capital(connection: psycopg2.extensions.connection, user_id: int, capital_id: int) -> bool:
    """
    Delete a capital entry by ID for a user.
    Note: Does not commit transaction; caller must call commit().
    """
    logger.debug(f"[ProcessData.py].delete_capital(): Deleting capital ID {capital_id} for user {user_id}")
    with connection.cursor() as cursor:
        cursor.execute("DELETE FROM capital WHERE id = %s AND user_id = %s", (capital_id, user_id))
        return cursor.rowcount > 0


# ==========================================
# SysValue CRUD Operations (Universal Settings)
# ==========================================

def get_sysvalues(connection: psycopg2.extensions.connection) -> List[Dict[str, Any]]:
    """
    Retrieve all universal system configuration values.
    Note: Does not commit transaction.
    """
    logger.debug("[ProcessData.py].get_sysvalues(): Querying sysvalue table")
    with connection.cursor() as cursor:
        cursor.execute("SELECT name, type, strvalue, numvalue, datevalue, description, updatetimestamp FROM sysvalue ORDER BY name")
        results = []
        for row in cursor.fetchall():
            results.append({
                "name": row[0],
                "type": row[1],
                "strvalue": row[2],
                "numvalue": row[3],
                "datevalue": row[4].isoformat() if hasattr(row[4], 'isoformat') else (str(row[4]) if row[4] else None),
                "description": row[5],
                "updatetimestamp": row[6].isoformat() if hasattr(row[6], 'isoformat') else str(row[6])
            })
        return results


def insert_sysvalue(
    connection: psycopg2.extensions.connection, 
    name: str, 
    val_type: str, 
    strvalue: Optional[str], 
    numvalue: Optional[float], 
    datevalue: Optional[Any], 
    description: Optional[str]
) -> Dict[str, Any]:
    """
    Insert a new universal system setting record.
    Note: Does not commit transaction; caller must call commit().
    """
    logger.debug(f"[ProcessData.py].insert_sysvalue(): Inserting sysvalue {name}")
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO sysvalue (name, type, strvalue, numvalue, datevalue, description, updatetimestamp)
            VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
            RETURNING name, type, strvalue, numvalue, datevalue, description, updatetimestamp
            """,
            (name, val_type, strvalue, numvalue, datevalue, description)
        )
        row = cursor.fetchone()
        return {
        "name": row[0], "type": row[1], "strvalue": row[2], "numvalue": row[3],
        "datevalue": row[4].isoformat() if hasattr(row[4], 'isoformat') else (str(row[4]) if row[4] else None),
        "description": row[5], "updatetimestamp": row[6].isoformat() if hasattr(row[6], 'isoformat') else str(row[6])
    }


def update_sysvalue(
    connection: psycopg2.extensions.connection, 
    name: str, 
    val_type: Optional[str] = None, 
    strvalue: Optional[str] = None, 
    numvalue: Optional[float] = None, 
    datevalue: Optional[Any] = None, 
    description: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Update existing system setting fields.
    Note: Does not commit transaction; caller must call commit().
    """
    logger.debug(f"[ProcessData.py].update_sysvalue(): Updating sysvalue {name}")
    
    fields = []
    params = []
    if val_type is not None:
        fields.append("type = %s")
        params.append(val_type)
    if strvalue is not None:
        fields.append("strvalue = %s")
        params.append(strvalue)
    if numvalue is not None:
        fields.append("numvalue = %s")
        params.append(numvalue)
    if datevalue is not None:
        fields.append("datevalue = %s")
        params.append(datevalue)
    if description is not None:
        fields.append("description = %s")
        params.append(description)
        
    with connection.cursor() as cursor:
        if not fields:
            cursor.execute("SELECT name, type, strvalue, numvalue, datevalue, description, updatetimestamp FROM sysvalue WHERE name = %s", (name,))
            row = cursor.fetchone()
            if row:
                return {
                    "name": row[0], "type": row[1], "strvalue": row[2], "numvalue": row[3],
                    "datevalue": row[4].isoformat() if hasattr(row[4], 'isoformat') else (str(row[4]) if row[4] else None),
                    "description": row[5], "updatetimestamp": row[6].isoformat() if hasattr(row[6], 'isoformat') else str(row[6])
                }
            return None
            
        params.append(name)
        query = f"""
            UPDATE sysvalue 
            SET {', '.join(fields)}, updatetimestamp = CURRENT_TIMESTAMP
            WHERE name = %s
            RETURNING name, type, strvalue, numvalue, datevalue, description, updatetimestamp
        """
        cursor.execute(query, params)
        row = cursor.fetchone()
        if row:
            return {
                "name": row[0], "type": row[1], "strvalue": row[2], "numvalue": row[3],
                "datevalue": row[4].isoformat() if hasattr(row[4], 'isoformat') else (str(row[4]) if row[4] else None),
                "description": row[5], "updatetimestamp": row[6].isoformat() if hasattr(row[6], 'isoformat') else str(row[6])
            }
    return None


def delete_sysvalue(connection: psycopg2.extensions.connection, name: str) -> bool:
    """
    Delete a system setting by name.
    Note: Does not commit transaction; caller must call commit().
    """
    logger.debug(f"[ProcessData.py].delete_sysvalue(): Deleting sysvalue {name}")
    with connection.cursor() as cursor:
        cursor.execute("DELETE FROM sysvalue WHERE name = %s", (name,))
        return cursor.rowcount > 0


# ==========================================
# User & Role Management Helpers
# ==========================================

def get_user_by_email(connection: psycopg2.extensions.connection, email: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve user details by email.
    Note: Does not commit transaction.
    """
    logger.debug(f"[ProcessData.py].get_user_by_email(): Querying email {email}")
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT id, email, name, picture, google_id, status, created_at, updatetimestamp FROM users WHERE email = %s",
            (email,)
        )
        row = cursor.fetchone()
        if row:
            return {
                "id": row[0],
                "email": row[1],
                "name": row[2],
                "picture": row[3],
                "google_id": row[4],
                "status": row[5],
                "created_at": row[6].isoformat() if hasattr(row[6], 'isoformat') else str(row[6]),
                "updatetimestamp": row[7].isoformat() if hasattr(row[7], 'isoformat') else str(row[7])
            }
        return None


def create_user(
    connection: psycopg2.extensions.connection, 
    email: str, 
    name: str, 
    picture: Optional[str], 
    google_id: Optional[str]
) -> Dict[str, Any]:
    """
    Insert a new user profile or link google_id to existing pre-registered profile.
    Note: Does not commit transaction; caller must call commit().
    """
    logger.debug(f"[ProcessData.py].create_user(): Creating/updating profile for {email}")
    
    user = get_user_by_email(connection, email)
    with connection.cursor() as cursor:
        if user:
            if not user["google_id"] and google_id:
                cursor.execute(
                    """
                    UPDATE users 
                    SET google_id = %s, name = %s, picture = %s, updatetimestamp = CURRENT_TIMESTAMP 
                    WHERE id = %s 
                    RETURNING id, email, name, picture, google_id, status, created_at, updatetimestamp
                    """,
                    (google_id, name, picture, user["id"])
                )
                row = cursor.fetchone()
                return {
                    "id": row[0], "email": row[1], "name": row[2], "picture": row[3],
                    "google_id": row[4], "status": row[5],
                    "created_at": row[6].isoformat() if hasattr(row[6], 'isoformat') else str(row[6]),
                    "updatetimestamp": row[7].isoformat() if hasattr(row[7], 'isoformat') else str(row[7])
                }
            return user

        cursor.execute(
            """
            INSERT INTO users (email, name, picture, google_id, status, created_at, updatetimestamp)
            VALUES (%s, %s, %s, %s, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id, email, name, picture, google_id, status, created_at, updatetimestamp
            """,
            (email, name, picture, google_id)
        )
        row = cursor.fetchone()
        return {
            "id": row[0],
            "email": row[1],
            "name": row[2],
            "picture": row[3],
            "google_id": row[4],
            "status": row[5],
            "created_at": row[6].isoformat() if hasattr(row[6], 'isoformat') else str(row[6]),
            "updatetimestamp": row[7].isoformat() if hasattr(row[7], 'isoformat') else str(row[7])
        }


def get_user_roles(connection: psycopg2.extensions.connection, user_id: int) -> List[str]:
    """
    Retrieve list of active roles for a user ID.
    Note: Does not commit transaction.
    """
    logger.debug(f"[ProcessData.py].get_user_roles(): Querying user ID {user_id}")
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT role FROM user_roles WHERE user_id = %s AND status = 'active'",
            (user_id,)
        )
        return [row[0] for row in cursor.fetchall()]


def update_user_status(connection: psycopg2.extensions.connection, user_id: int, status: str) -> bool:
    """
    Update user status to active or expired (soft delete).
    Note: Does not commit transaction; caller must call commit().
    """
    logger.debug(f"[ProcessData.py].update_user_status(): Updating status for user ID {user_id} to {status}")
    with connection.cursor() as cursor:
        cursor.execute(
            "UPDATE users SET status = %s, updatetimestamp = CURRENT_TIMESTAMP WHERE id = %s",
            (status, user_id)
        )
        return cursor.rowcount > 0


def get_all_users_with_roles(connection: psycopg2.extensions.connection) -> List[Dict[str, Any]]:
    """
    Retrieve all users with aggregated roles array.
    Note: Does not commit transaction.
    """
    logger.debug("[ProcessData.py].get_all_users_with_roles(): Querying all users")
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT u.id, u.email, u.name, u.picture, u.status, u.created_at,
                   COALESCE(string_agg(r.role, ','), '') as roles
            FROM users u
            LEFT JOIN user_roles r ON u.id = r.user_id AND r.status = 'active'
            GROUP BY u.id, u.email, u.name, u.picture, u.status, u.created_at
            ORDER BY u.id
            """
        )
        results = []
        for row in cursor.fetchall():
            results.append({
                "id": row[0],
                "email": row[1],
                "name": row[2],
                "picture": row[3],
                "status": row[4],
                "created_at": row[5].isoformat() if hasattr(row[5], 'isoformat') else str(row[5]),
                "roles": [r for r in row[6].split(',') if r]
            })
        return results


def link_user_role(connection: psycopg2.extensions.connection, user_id: int, role: str) -> bool:
    """
    Link a role to a user (activating it if expired or creating it new).
    Note: Does not commit transaction; caller must call commit().
    """
    logger.debug(f"[ProcessData.py].link_user_role(): Linking role {role} to user {user_id}")
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT id FROM user_roles WHERE user_id = %s AND role = %s",
            (user_id, role)
        )
        row = cursor.fetchone()
        if row:
            cursor.execute(
                "UPDATE user_roles SET status = 'active', updatetimestamp = CURRENT_TIMESTAMP WHERE id = %s",
                (row[0],)
            )
        else:
            cursor.execute(
                "INSERT INTO user_roles (user_id, role, status, assigned_at, updatetimestamp) VALUES (%s, %s, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                (user_id, role)
            )
        return True


def unlink_user_role(connection: psycopg2.extensions.connection, user_id: int, role: str) -> bool:
    """
    Unlink (expire) a role for a user.
    Note: Does not commit transaction; caller must call commit().
    """
    logger.debug(f"[ProcessData.py].unlink_user_role(): Unlinking role {role} from user {user_id}")
    with connection.cursor() as cursor:
        cursor.execute(
            "UPDATE user_roles SET status = 'expired', updatetimestamp = CURRENT_TIMESTAMP WHERE user_id = %s AND role = %s",
            (user_id, role)
        )
        return cursor.rowcount > 0


def get_portfolio_date_data(connection: psycopg2.extensions.connection, user_id: int, date_val: Any) -> Dict[str, Any]:
    """
    Retrieve aggregated portfolio historical date-data including positions, capital, trades, 
    EOD prices, and watchlist symbols for a specific date and user.
    """
    logger.debug(f"[ProcessData.py].get_portfolio_date_data(): Querying portfolio date-data for user {user_id} on date {date_val}")
    with connection.cursor() as cursor:
        # 1. Positions (including investment flag)
        cursor.execute(
            """
            SELECT p.symbol, p.avgprice, p.quantity, p.eodprice, p.tradedate, w.name, w.currency, p.investment
            FROM position p
            LEFT JOIN watchlist w ON p.symbol = w.symbol AND p.user_id = w.user_id
            WHERE p.user_id = %s AND p.tradedate = %s
            ORDER BY p.symbol
            """,
            (user_id, date_val)
        )
        positions = []
        for row in cursor.fetchall():
            positions.append({
                "symbol": row[0],
                "avgprice": float(row[1]) if row[1] is not None else 0.0,
                "quantity": float(row[2]) if row[2] is not None else 0.0,
                "eodprice": float(row[3]) if row[3] is not None else 0.0,
                "tradedate": row[4].strftime('%Y-%m-%d') if hasattr(row[4], 'strftime') else str(row[4]) if row[4] else None,
                "name": row[5],
                "currency": row[6],
                "investment": bool(row[7]) if row[7] is not None else True
            })

        # 2. Capital
        cursor.execute(
            """
            SELECT id, broker, transtype, accounttype, amount, date, currency, remarks
            FROM capital
            WHERE user_id = %s AND date <= %s
            ORDER BY date DESC, id DESC
            """,
            (user_id, date_val)
        )
        capital = []
        for row in cursor.fetchall():
            capital.append({
                "id": row[0],
                "broker": row[1],
                "transtype": row[2],
                "accounttype": row[3],
                "amount": float(row[4]) if row[4] is not None else 0.0,
                "date": row[5].strftime('%Y-%m-%d') if hasattr(row[5], 'strftime') else str(row[5]) if row[5] else None,
                "currency": row[6],
                "remarks": row[7]
            })

        # 3. Trades (including id and investment flag)
        cursor.execute(
            """
            SELECT buysell, price, quantity, tradedate, symbol, remarks, id, investment
            FROM trade
            WHERE user_id = %s 
              AND tradedate <= %s
              AND price IS NOT NULL 
              AND quantity IS NOT NULL 
              AND tradedate IS NOT NULL 
              AND buysell IS NOT NULL
            ORDER BY tradedate ASC
            """,
            (user_id, date_val)
        )
        trades = []
        for row in cursor.fetchall():
            trades.append({
                "buysell": row[0],
                "price": float(row[1]) if row[1] is not None else 0.0,
                "quantity": float(row[2]) if row[2] is not None else 0.0,
                "tradedate": row[3].strftime('%Y-%m-%d') if hasattr(row[3], 'strftime') else str(row[3]) if row[3] else None,
                "symbol": row[4],
                "remarks": row[5],
                "id": row[6],
                "investment": bool(row[7]) if row[7] is not None else True
            })

        # 4. Last 50 Trades (for dedicated transaction table)
        cursor.execute(
            """
            SELECT id, symbol, buysell, tradedate, investment, price, quantity, remarks
            FROM trade
            WHERE user_id = %s 
              AND tradedate <= %s
              AND price IS NOT NULL AND quantity IS NOT NULL
            ORDER BY tradedate DESC, id DESC
            LIMIT 50
            """,
            (user_id, date_val)
        )
        last_50_trades = []
        for row in cursor.fetchall():
            last_50_trades.append({
                "id": row[0],
                "symbol": row[1],
                "buysell": row[2],
                "tradedate": row[3].strftime('%Y-%m-%d') if hasattr(row[3], 'strftime') else str(row[3]) if row[3] else None,
                "investment": bool(row[4]) if row[4] is not None else True,
                "price": float(row[5]) if row[5] is not None else 0.0,
                "quantity": float(row[6]) if row[6] is not None else 0.0,
                "remarks": row[7]
            })

        # 5. Last 50 Capital Movements
        cursor.execute(
            """
            SELECT id, broker, transtype, accounttype, amount, date, currency, remarks
            FROM capital
            WHERE user_id = %s AND date <= %s
            ORDER BY date DESC, id DESC
            LIMIT 50
            """,
            (user_id, date_val)
        )
        last_50_capital = []
        for row in cursor.fetchall():
            last_50_capital.append({
                "id": row[0],
                "broker": row[1],
                "transtype": row[2],
                "accounttype": row[3],
                "amount": float(row[4]) if row[4] is not None else 0.0,
                "date": row[5].strftime('%Y-%m-%d') if hasattr(row[5], 'strftime') else str(row[5]) if row[5] else None,
                "currency": row[6],
                "remarks": row[7]
            })

        # 6. Account Balances (Net Capital by Broker, Account Type, Currency)
        cursor.execute(
            """
            SELECT broker, accounttype, currency, SUM(amount) as net_capital
            FROM capital
            WHERE user_id = %s AND date <= %s
            GROUP BY broker, accounttype, currency
            ORDER BY broker, accounttype, currency
            """,
            (user_id, date_val)
        )
        account_balances = []
        for row in cursor.fetchall():
            account_balances.append({
                "broker": row[0],
                "accountType": row[1],
                "currency": row[2],
                "balance": float(row[3]) if row[3] is not None else 0.0
            })

        # 7. FX Rates
        cursor.execute(
            """
            SELECT currency, rate 
            FROM exchange_rate 
            WHERE date = (SELECT MAX(date) FROM exchange_rate WHERE date <= %s) 
              AND base_currency = 'USD'
            """,
            (date_val,)
        )
        fx_rates = {}
        for row in cursor.fetchall():
            fx_rates[row[0]] = float(row[1])

        # 8. EodPrices
        cursor.execute(
            """
            SELECT DISTINCT ON (symbol) symbol, close
            FROM eoddata
            WHERE date <= %s
            ORDER BY symbol, date DESC
            """,
            (date_val,)
        )
        eod_prices = {}
        for row in cursor.fetchall():
            eod_prices[row[0]] = float(row[1]) if row[1] is not None else 0.0

        # 7. Watchlist
        cursor.execute(
            """
            SELECT symbol, name, currency
            FROM watchlist
            WHERE user_id = %s
            """,
            (user_id,)
        )
        watchlist_names = {}
        watchlist_currencies = {}
        for row in cursor.fetchall():
            sym = row[0]
            watchlist_names[sym] = row[1] or sym
            watchlist_currencies[sym] = row[2] or "USD"

        # 8. Point-in-Time Summary Metrics (from daily_portfolio_summary)
        cursor.execute(
            """
            SELECT currency, investment, total_capital, position_market_value, realized_pnl, unrealized_pnl,
                   margin_loan_balance, daily_interest_accrued, cumulative_interest_accrued,
                   total_asset_value, total_pnl, pct_pnl
            FROM daily_portfolio_summary
            WHERE user_id = %s AND date = %s
            """,
            (user_id, date_val)
        )
        summary_metrics = []
        for row in cursor.fetchall():
            summary_metrics.append({
                "currency": row[0],
                "investment": row[1],
                "totalCapital": float(row[2] or 0.0),
                "positionMarketValue": float(row[3] or 0.0),
                "realizedPnL": float(row[4] or 0.0),
                "unrealizedPnL": float(row[5] or 0.0),
                "marginLoanBalance": float(row[6] or 0.0),
                "dailyInterestAccrued": float(row[7] or 0.0),
                "cumulativeInterestAccrued": float(row[8] or 0.0),
                "totalAssetValue": float(row[9] or 0.0),
                "totalPnL": float(row[10] or 0.0),
                "pctPnL": float(row[11] or 0.0)
            })

        # 9. 12-Month Time-Series Data (from daily_portfolio_summary)
        cursor.execute(
            """
            SELECT date, currency, investment, total_capital, position_market_value, realized_pnl, unrealized_pnl,
                   margin_loan_balance, total_asset_value, total_pnl, pct_pnl
            FROM daily_portfolio_summary
            WHERE user_id = %s AND date BETWEEN (%s::date - INTERVAL '365 days') AND %s::date
            ORDER BY date ASC
            """,
            (user_id, date_val, date_val)
        )
        timeseries_12m = []
        for row in cursor.fetchall():
            timeseries_12m.append({
                "date": row[0].strftime('%Y-%m-%d') if hasattr(row[0], 'strftime') else str(row[0]) if row[0] else None,
                "currency": row[1],
                "investment": row[2],
                "totalCapital": float(row[3] or 0.0),
                "positionMarketValue": float(row[4] or 0.0),
                "realizedPnL": float(row[5] or 0.0),
                "unrealizedPnL": float(row[6] or 0.0),
                "marginLoanBalance": float(row[7] or 0.0),
                "totalAssetValue": float(row[8] or 0.0),
                "totalPnL": float(row[9] or 0.0),
                "pctPnL": float(row[10] or 0.0)
            })

        # 10. Margin Interest Details on date_val
        cursor.execute(
            """
            SELECT broker, currency, loan_balance, daily_rate, daily_interest, cumulative_interest
            FROM daily_margin_interest
            WHERE user_id = %s AND date = %s
            ORDER BY broker, currency
            """,
            (user_id, date_val)
        )
        margin_interest_details = []
        for row in cursor.fetchall():
            margin_interest_details.append({
                "broker": row[0],
                "currency": row[1],
                "loanBalance": float(row[2] or 0.0),
                "dailyRate": float(row[3] or 0.0),
                "dailyInterest": float(row[4] or 0.0),
                "cumulativeInterest": float(row[5] or 0.0)
            })

        return {
            "positions": positions,
            "capital": capital,
            "trades": trades,
            "last50Trades": last_50_trades,
            "last50Capital": last_50_capital,
            "accountBalances": account_balances,
            "fxRates": fx_rates,
            "summaryMetrics": summary_metrics,
            "timeseries12m": timeseries_12m,
            "marginInterestDetails": margin_interest_details,
            "eodPrices": eod_prices,
            "watchlistNames": watchlist_names,
            "watchlistCurrencies": watchlist_currencies
        }


def get_batch_refresh_date_range(connection: psycopg2.extensions.connection) -> tuple:
    """
    Determines the shared start_date and end_date for batch refresh across
    run_mark_to_market.py, run_daily_margin_interest.py, and run_portfolio_summary.py.
    """
    with connection.cursor() as cursor:
        smart_query = """
            SELECT MIN(d) FROM (
                SELECT MIN(tradedate::date) AS d 
                FROM public.trade
                WHERE updatetimestamp >= (
                    SELECT (datevalue - INTERVAL '5 days') 
                    FROM public.sysvalue 
                    WHERE name = 'GLOBAL_TODAY'
                )
                UNION ALL
                SELECT MIN(date::date) AS d 
                FROM public.capital
                WHERE updatetimestamp >= (
                    SELECT (datevalue - INTERVAL '5 days') 
                    FROM public.sysvalue 
                    WHERE name = 'GLOBAL_TODAY'
                )
            ) sub WHERE d IS NOT NULL
        """
        cursor.execute(smart_query)
        res = cursor.fetchone()
        min_date = res[0] if res else None

        cursor.execute("SELECT datevalue::date FROM public.sysvalue WHERE name = 'GLOBAL_TODAY'")
        today_row = cursor.fetchone()
        global_today = today_row[0] if today_row and today_row[0] else None

        if min_date is not None:
            if hasattr(min_date, 'date'):
                min_date = min_date.date()
            start_date = min_date
        else:
            cursor.execute("SELECT datevalue::date FROM public.sysvalue WHERE name = 'GLOBAL_STARTDATE'")
            start_row = cursor.fetchone()
            start_date = start_row[0] if start_row and start_row[0] else None

        return start_date, global_today


def get_margin_interest_rates(connection: psycopg2.extensions.connection) -> List[Dict[str, Any]]:
    """Retrieve active margin interest rate rules from margin_interest_rate table."""
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id, broker, currency, accounttype, annual_rate, day_count_basis, effective_date
            FROM margin_interest_rate
            ORDER BY effective_date ASC, id ASC
            """
        )
        rates = []
        for row in cursor.fetchall():
            rates.append({
                "id": row[0],
                "broker": row[1],
                "currency": row[2],
                "accounttype": row[3],
                "annual_rate": float(row[4]),
                "day_count_basis": int(row[5]),
                "effective_date": row[6]
            })
        return rates






