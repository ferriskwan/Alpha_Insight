"""Pydantic schemas for Reference Data and Technical Chart Settings with JSONB parameter store."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SysValueDTO(BaseModel):
    """Data transfer object for system key-value configuration."""

    model_config = ConfigDict(from_attributes=True)

    name: str
    type: str
    strvalue: Optional[str] = None
    numvalue: Optional[float] = None
    datevalue: Optional[Union[date, str]] = None
    description: Optional[str] = None
    updatetimestamp: Optional[Union[datetime, str]] = None


class SysValueUpdate(BaseModel):
    """Payload for updating a system configuration value."""

    type: Optional[str] = None
    strvalue: Optional[str] = None
    numvalue: Optional[float] = None
    datevalue: Optional[str] = None
    description: Optional[str] = None


class MovingAveragesParams(BaseModel):
    """Configuration for simple and exponential moving averages."""

    sma_period: int = 30
    ema_period: int = 100


class BollingerBandsParams(BaseModel):
    """Configuration for Bollinger Bands volatility channels."""

    period: int = 30
    std_dev: float = 2.0


class RSIParams(BaseModel):
    """Configuration for Relative Strength Index oscillator and threshold bands."""

    period: int = 13
    overbought: float = 70.0
    oversold: float = 30.0


class MACDParams(BaseModel):
    """Configuration for Moving Average Convergence Divergence."""

    fast: int = 12
    slow: int = 26
    signal: int = 9


class FibonacciParams(BaseModel):
    """Configuration for Fibonacci retracement cycle lookback windows."""

    lookback_bars: int = 252
    intraday_bars: int = 78


class ChartParametersSchema(BaseModel):
    """Canonical structured parameters for technical chart overlays and oscillators."""

    moving_averages: MovingAveragesParams = Field(default_factory=MovingAveragesParams)
    bollinger_bands: BollingerBandsParams = Field(default_factory=BollingerBandsParams)
    rsi: RSIParams = Field(default_factory=RSIParams)
    macd: MACDParams = Field(default_factory=MACDParams)
    fibonacci: FibonacciParams = Field(default_factory=FibonacciParams)


class ChartSettingsDTO(BaseModel):
    """Data transfer object for technical chart indicator parameters.

    Provides structured `parameters` along with backward-compatible flat properties.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: Optional[int] = None
    symbol: Optional[str] = None
    parameters: ChartParametersSchema = Field(default_factory=ChartParametersSchema)

    # Backward-compatible flat indicator properties
    sma_period: int = 30
    ema_period: int = 100
    bb_period: int = 30
    bb_std: float = 2.0
    rsi_period: int = 13
    rsi_ob: float = 70.0
    rsi_os: float = 30.0
    macd_fast: int = 12
    macd_slow: int = 26
    macd_signal: int = 9
    fib_lookback_bars: int = 252
    fib_intraday_bars: int = 78

    @model_validator(mode="before")
    @classmethod
    def populate_flat_fields_and_parameters(cls, data: Any) -> Any:
        """Harmonize parameters JSONB object and flat accessors bidirectionally."""
        if hasattr(data, "__dict__"):
            raw_dict = dict(data.__dict__)
        elif isinstance(data, dict):
            raw_dict = dict(data)
        else:
            return data

        raw_params = raw_dict.get("parameters") or {}
        if isinstance(raw_params, str):
            import json

            try:
                raw_params = json.loads(raw_params)
            except Exception:
                raw_params = {}

        ma = raw_params.get("moving_averages") or {}
        bb = raw_params.get("bollinger_bands") or {}
        rsi = raw_params.get("rsi") or {}
        macd = raw_params.get("macd") or {}
        fib = raw_params.get("fibonacci") or {}

        # Set flat fields from parameters or preserve existing
        raw_dict["sma_period"] = ma.get("sma_period", raw_dict.get("sma_period", 30))
        raw_dict["ema_period"] = ma.get("ema_period", raw_dict.get("ema_period", 100))
        raw_dict["bb_period"] = bb.get("period", raw_dict.get("bb_period", 30))
        raw_dict["bb_std"] = bb.get("std_dev", raw_dict.get("bb_std", 2.0))
        raw_dict["rsi_period"] = rsi.get("period", raw_dict.get("rsi_period", 13))
        raw_dict["rsi_ob"] = rsi.get("overbought", raw_dict.get("rsi_ob", 70.0))
        raw_dict["rsi_os"] = rsi.get("oversold", raw_dict.get("rsi_os", 30.0))
        raw_dict["macd_fast"] = macd.get("fast", raw_dict.get("macd_fast", 12))
        raw_dict["macd_slow"] = macd.get("slow", raw_dict.get("macd_slow", 26))
        raw_dict["macd_signal"] = macd.get("signal", raw_dict.get("macd_signal", 9))
        raw_dict["fib_lookback_bars"] = fib.get("lookback_bars", raw_dict.get("fib_lookback_bars", 252))
        raw_dict["fib_intraday_bars"] = fib.get("intraday_bars", raw_dict.get("fib_intraday_bars", 78))

        # Ensure parameters object itself is hydrated
        raw_dict["parameters"] = {
            "moving_averages": {
                "sma_period": raw_dict["sma_period"],
                "ema_period": raw_dict["ema_period"],
            },
            "bollinger_bands": {
                "period": raw_dict["bb_period"],
                "std_dev": raw_dict["bb_std"],
            },
            "rsi": {
                "period": raw_dict["rsi_period"],
                "overbought": raw_dict["rsi_ob"],
                "oversold": raw_dict["rsi_os"],
            },
            "macd": {
                "fast": raw_dict["macd_fast"],
                "slow": raw_dict["macd_slow"],
                "signal": raw_dict["macd_signal"],
            },
            "fibonacci": {
                "lookback_bars": raw_dict["fib_lookback_bars"],
                "intraday_bars": raw_dict["fib_intraday_bars"],
            },
        }
        return raw_dict


class ChartSettingsUpdate(BaseModel):
    """Payload for modifying or upserting technical chart parameters.

    Accepts structured `parameters` or individual flat parameter fields.
    """

    user_id: Optional[int] = None
    symbol: Optional[str] = None
    parameters: Optional[Union[ChartParametersSchema, dict[str, Any]]] = None

    # Optional flat indicator overrides for backward compatibility
    sma_period: Optional[int] = None
    ema_period: Optional[int] = None
    bb_period: Optional[int] = None
    bb_std: Optional[float] = None
    rsi_period: Optional[int] = None
    rsi_ob: Optional[float] = None
    rsi_os: Optional[float] = None
    macd_fast: Optional[int] = None
    macd_slow: Optional[int] = None
    macd_signal: Optional[int] = None
    fib_lookback_bars: Optional[int] = None
    fib_intraday_bars: Optional[int] = None
