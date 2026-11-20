"""Repository for SysValue configuration and RefChartSettings technical parameters.

Implements 4-tier inheritance cascade (User+Symbol -> User -> Symbol -> Global Baseline)
with deep JSON merging over PostgreSQL JSONB parameter store.
"""

from __future__ import annotations

import copy
from datetime import date, datetime, timezone
from typing import Any, Optional, Union

from sqlalchemy import and_, select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from backend.db.models import RefChartSettings, SysValue
from backend.schemas.ref_data import (
    ChartParametersSchema,
    ChartSettingsUpdate,
    SysValueUpdate,
)

DEFAULT_CHART_PARAMETERS: dict[str, Any] = {
    "moving_averages": {"sma_period": 30, "ema_period": 100},
    "bollinger_bands": {"period": 30, "std_dev": 2.0},
    "rsi": {"period": 13, "overbought": 70.0, "oversold": 30.0},
    "macd": {"fast": 12, "slow": 26, "signal": 9},
    "fibonacci": {"lookback_bars": 252, "intraday_bars": 78},
}


def deep_merge_dicts(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    """Recursively merge override dictionary into a copy of base dictionary."""
    result = dict(base)
    for k, v in override.items():
        if k in result and isinstance(result[k], dict) and isinstance(v, dict):
            result[k] = deep_merge_dicts(result[k], v)
        else:
            result[k] = v
    return result


def get_sysvalues(db: Session) -> list[SysValue]:
    """Retrieve all configuration parameters from public.sysvalue."""
    stmt = select(SysValue).order_by(SysValue.name)
    return list(db.scalars(stmt).all())


def get_sysvalue_by_name(db: Session, name: str) -> Optional[SysValue]:
    """Retrieve a single system configuration entry by name."""
    return db.scalar(select(SysValue).where(SysValue.name == name))


def get_default_currency(db: Session) -> str:
    """Retrieve global default currency code from sysvalue, defaulting to SGD."""
    record = get_sysvalue_by_name(db, "DEFAULT_CURRENCY")
    if record and record.strvalue:
        return record.strvalue.strip().upper()
    return "SGD"


def update_sysvalue(
    db: Session,
    name: str,
    update_data: Union[dict[str, Any], SysValueUpdate],
) -> Optional[SysValue]:
    """Update existing sysvalue parameter fields."""
    record = get_sysvalue_by_name(db, name)
    if not record:
        return None

    data = update_data.model_dump(exclude_unset=True) if isinstance(update_data, SysValueUpdate) else dict(update_data)

    if "type" in data and data["type"] is not None:
        record.type = data["type"]
    if "strvalue" in data:
        record.strvalue = data["strvalue"]
    if "numvalue" in data:
        record.numvalue = data["numvalue"]
    if "datevalue" in data:
        raw_date = data["datevalue"]
        if isinstance(raw_date, str) and raw_date:
            record.datevalue = datetime.fromisoformat(raw_date).date()
        elif isinstance(raw_date, date):
            record.datevalue = raw_date
        else:
            record.datevalue = None
    if "description" in data and data["description"] is not None:
        record.description = data["description"]

    record.updatetimestamp = datetime.now(timezone.utc)
    db.commit()
    db.refresh(record)
    return record


def get_chart_settings(
    db: Session,
    user_id: Optional[int] = None,
    symbol: Optional[str] = None,
) -> Optional[RefChartSettings]:
    """Resolve chart settings with 4-tier fallback cascade & deep merge.

    Hierarchy:
    1. Global Baseline (user_id IS NULL AND symbol IS NULL)
    2. Overlay Symbol Preset (user_id IS NULL AND symbol = :symbol)
    3. Overlay User Default (user_id = :user_id AND symbol IS NULL)
    4. Overlay User + Symbol Override (user_id = :user_id AND symbol = :symbol)
    """
    clean_sym = symbol.upper().strip() if symbol else None

    # Step 1: Base settings from Global Baseline
    global_record = db.scalar(
        select(RefChartSettings).where(
            RefChartSettings.user_id.is_(None),
            RefChartSettings.symbol.is_(None),
        )
    )
    if not global_record:
        global_record = db.scalar(select(RefChartSettings).limit(1))

    effective_params = (
        dict(global_record.parameters) if global_record and global_record.parameters else dict(DEFAULT_CHART_PARAMETERS)
    )
    best_matching_record = global_record

    # Step 2: Overlay Symbol Preset (if symbol provided)
    if clean_sym:
        sym_preset = db.scalar(
            select(RefChartSettings).where(
                RefChartSettings.user_id.is_(None),
                RefChartSettings.symbol == clean_sym,
            )
        )
        if sym_preset and sym_preset.parameters:
            effective_params = deep_merge_dicts(effective_params, sym_preset.parameters)
            best_matching_record = sym_preset

    # Step 3: Overlay User Default (if user_id provided)
    if user_id is not None:
        user_default = db.scalar(
            select(RefChartSettings).where(
                RefChartSettings.user_id == user_id,
                RefChartSettings.symbol.is_(None),
            )
        )
        if user_default and user_default.parameters:
            effective_params = deep_merge_dicts(effective_params, user_default.parameters)
            best_matching_record = user_default

    # Step 4: Overlay User + Symbol Override (if both provided)
    if user_id is not None and clean_sym:
        user_sym = db.scalar(
            select(RefChartSettings).where(
                RefChartSettings.user_id == user_id,
                RefChartSettings.symbol == clean_sym,
            )
        )
        if user_sym and user_sym.parameters:
            effective_params = deep_merge_dicts(effective_params, user_sym.parameters)
            best_matching_record = user_sym

    if not best_matching_record:
        return None

    # Attach merged effective parameters
    best_matching_record.parameters = effective_params
    return best_matching_record


def get_all_chart_settings(
    db: Session,
    user_id: Optional[int] = None,
    symbol: Optional[str] = None,
) -> list[RefChartSettings]:
    """Retrieve list of chart settings filtered optionally by user or symbol."""
    stmt = select(RefChartSettings).order_by(RefChartSettings.id)
    if user_id is not None:
        stmt = stmt.where(RefChartSettings.user_id == user_id)
    if symbol is not None:
        stmt = stmt.where(RefChartSettings.symbol == symbol.upper().strip())
    return list(db.scalars(stmt).all())


def update_chart_settings(
    db: Session,
    settings_id: Optional[int] = None,
    update_data: Union[dict[str, Any], ChartSettingsUpdate] = None,  # type: ignore[assignment]
) -> RefChartSettings:
    """Update existing technical indicator parameters or create new hierarchy record."""
    data = (
        update_data.model_dump(exclude_unset=True)
        if isinstance(update_data, ChartSettingsUpdate)
        else dict(update_data or {})
    )

    clean_sym = str(data["symbol"]).upper().strip() if data.get("symbol") else None
    user_id = data.get("user_id")

    record: Optional[RefChartSettings] = None
    if settings_id:
        record = db.scalar(select(RefChartSettings).where(RefChartSettings.id == settings_id))

    if not record:
        if user_id is not None or clean_sym is not None:
            conditions = []
            conditions.append(
                RefChartSettings.user_id == user_id if user_id is not None else RefChartSettings.user_id.is_(None)
            )
            conditions.append(
                RefChartSettings.symbol == clean_sym if clean_sym is not None else RefChartSettings.symbol.is_(None)
            )
            record = db.scalar(select(RefChartSettings).where(and_(*conditions)))
        else:
            # Default to global baseline record
            record = db.scalar(
                select(RefChartSettings).where(
                    RefChartSettings.user_id.is_(None),
                    RefChartSettings.symbol.is_(None),
                )
            )

    # Prepare base parameter dictionary with deep copy
    base_params = (
        copy.deepcopy(record.parameters) if record and record.parameters else copy.deepcopy(DEFAULT_CHART_PARAMETERS)
    )

    # Merge incoming structured parameters if present
    incoming_params = data.get("parameters")
    if incoming_params:
        if isinstance(incoming_params, ChartParametersSchema):
            incoming_dict = incoming_params.model_dump()
        elif isinstance(incoming_params, dict):
            incoming_dict = incoming_params
        else:
            incoming_dict = {}
        base_params = deep_merge_dicts(base_params, incoming_dict)

    # Merge backward-compatible flat fields if present
    if "sma_period" in data and data["sma_period"] is not None:
        base_params.setdefault("moving_averages", {})["sma_period"] = data["sma_period"]
    if "ema_period" in data and data["ema_period"] is not None:
        base_params.setdefault("moving_averages", {})["ema_period"] = data["ema_period"]
    if "bb_period" in data and data["bb_period"] is not None:
        base_params.setdefault("bollinger_bands", {})["period"] = data["bb_period"]
    if "bb_std" in data and data["bb_std"] is not None:
        base_params.setdefault("bollinger_bands", {})["std_dev"] = data["bb_std"]
    if "rsi_period" in data and data["rsi_period"] is not None:
        base_params.setdefault("rsi", {})["period"] = data["rsi_period"]
    if "rsi_ob" in data and data["rsi_ob"] is not None:
        base_params.setdefault("rsi", {})["overbought"] = data["rsi_ob"]
    if "rsi_os" in data and data["rsi_os"] is not None:
        base_params.setdefault("rsi", {})["oversold"] = data["rsi_os"]
    if "macd_fast" in data and data["macd_fast"] is not None:
        base_params.setdefault("macd", {})["fast"] = data["macd_fast"]
    if "macd_slow" in data and data["macd_slow"] is not None:
        base_params.setdefault("macd", {})["slow"] = data["macd_slow"]
    if "macd_signal" in data and data["macd_signal"] is not None:
        base_params.setdefault("macd", {})["signal"] = data["macd_signal"]
    if "fib_lookback_bars" in data and data["fib_lookback_bars"] is not None:
        base_params.setdefault("fibonacci", {})["lookback_bars"] = data["fib_lookback_bars"]
    if "fib_intraday_bars" in data and data["fib_intraday_bars"] is not None:
        base_params.setdefault("fibonacci", {})["intraday_bars"] = data["fib_intraday_bars"]

    # Validate against ChartParametersSchema
    validated_params = ChartParametersSchema.model_validate(base_params).model_dump()

    if record:
        record.parameters = validated_params
        flag_modified(record, "parameters")
        record.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(record)
        return record

    # Create new hierarchy tier settings record
    record = RefChartSettings(
        user_id=user_id,
        symbol=clean_sym,
        parameters=validated_params,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record
