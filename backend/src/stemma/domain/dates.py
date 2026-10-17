"""Genealogical dates with explicit precision.

A date is written as ``YYYY``, ``YYYY-MM`` or ``YYYY-MM-DD``, optionally
prefixed with ``~`` for "circa". Full ISO dates already stored in the table
are valid partial dates, so no migration is needed.
"""

import calendar
import re
from typing import Annotated

from pydantic import AfterValidator

_PATTERN = re.compile(r"^(~)?(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$")


def parse_partial_date(value: str) -> tuple[bool, int, int | None, int | None]:
    match = _PATTERN.match(value)
    if not match:
        raise ValueError(f"not a partial date (YYYY, YYYY-MM or YYYY-MM-DD, optional ~): {value!r}")
    approx, year_s, month_s, day_s = match.groups()
    year = int(year_s)
    month = int(month_s) if month_s else None
    day = int(day_s) if day_s else None
    if month is not None and not 1 <= month <= 12:
        raise ValueError(f"month out of range: {value!r}")
    if day is not None and month is not None and not 1 <= day <= calendar.monthrange(year or 4, month)[1]:
        raise ValueError(f"day out of range: {value!r}")
    return approx is not None, year, month, day


def format_partial_date(approx: bool, year: int, month: int | None, day: int | None) -> str:
    text = f"{year:04d}"
    if month is not None:
        text += f"-{month:02d}"
        if day is not None:
            text += f"-{day:02d}"
    return ("~" if approx else "") + text


def _validate(value: str) -> str:
    parse_partial_date(value)
    return value


PartialDate = Annotated[str, AfterValidator(_validate)]
