from dataclasses import fields, is_dataclass
from datetime import date
from typing import Any, get_args, get_origin, get_type_hints

from stemma.domain import errors as err
from stemma.domain import requests as req
from stemma.domain import responses as resp

REQUEST_TYPES: dict[str, type] = {cls.__name__: cls for cls in get_args(req.Request)}
PERSON_DEFINITION_TYPES: dict[str, type] = {
    cls.__name__: cls for cls in get_args(req.PersonDefinition)
}


def decode_request(payload: dict) -> req.Request:
    if not isinstance(payload, dict) or len(payload) != 1:
        raise ValueError(f"expected single-key tagged object, got {payload!r}")
    [(tag, fields_dict)] = payload.items()
    cls = REQUEST_TYPES.get(tag)
    if cls is None:
        raise ValueError(f"unknown request type {tag!r}")
    return _decode_dataclass(cls, fields_dict)


def encode_response(response: resp.Response) -> dict:
    return {type(response).__name__: _encode_dataclass(response)}


def encode_error(error: err.StemmaError) -> dict:
    return {type(error).__name__: _encode_dataclass(error)}


def _encode_dataclass(value: Any) -> dict:
    out: dict[str, Any] = {}
    for f in fields(value):
        out[f.name] = _encode_value(getattr(value, f.name), f.type)
    return out


def _encode_value(value: Any, type_hint: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, date):
        return value.isoformat()
    if is_dataclass(value):
        if type(value) in PERSON_DEFINITION_TYPES.values():
            return {type(value).__name__: _encode_dataclass(value)}
        return _encode_dataclass(value)
    if isinstance(value, list):
        return [_encode_value(item, _list_item_type(type_hint)) for item in value]
    return value


def _list_item_type(type_hint: Any) -> Any:
    args = get_args(type_hint)
    return args[0] if args else Any


def _decode_dataclass[T](cls: type[T], payload: dict) -> T:
    hints = get_type_hints(cls)
    kwargs: dict[str, Any] = {}
    for f in fields(cls):  # type: ignore[arg-type]
        if f.name not in payload:
            continue
        kwargs[f.name] = _decode_value(payload[f.name], hints[f.name])
    return cls(**kwargs)


def _decode_value(value: Any, type_hint: Any) -> Any:
    if value is None:
        return None
    if _is_person_definition(type_hint):
        return _decode_person_definition(value)
    if type_hint is date:
        return date.fromisoformat(value)
    if _is_optional(type_hint):
        inner = _unwrap_optional(type_hint)
        return _decode_value(value, inner)
    if get_origin(type_hint) is list:
        item_type = get_args(type_hint)[0]
        return [_decode_value(item, item_type) for item in value]
    if isinstance(type_hint, type) and is_dataclass(type_hint):
        return _decode_dataclass(type_hint, value)
    return value


def _decode_person_definition(value: dict) -> req.PersonDefinition:
    if not isinstance(value, dict) or len(value) != 1:
        raise ValueError(f"expected single-key tagged object for PersonDefinition, got {value!r}")
    [(tag, fields_dict)] = value.items()
    cls = PERSON_DEFINITION_TYPES.get(tag)
    if cls is None:
        raise ValueError(f"unknown PersonDefinition type {tag!r}")
    return _decode_dataclass(cls, fields_dict)


def _is_optional(type_hint: Any) -> bool:
    args = get_args(type_hint)
    return type(None) in args


def _unwrap_optional(type_hint: Any) -> Any:
    return next(t for t in get_args(type_hint) if t is not type(None))


def _is_person_definition(type_hint: Any) -> bool:
    if type_hint is req.PersonDefinition:
        return True
    args = get_args(type_hint)
    pd_classes = set(PERSON_DEFINITION_TYPES.values())
    non_none = {t for t in args if t is not type(None)}
    return bool(non_none) and non_none.issubset(pd_classes)
