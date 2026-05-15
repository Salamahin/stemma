from typing import Any, get_args

from pydantic import TypeAdapter

from stemma.domain import errors as err
from stemma.domain import requests as req
from stemma.domain import responses as resp


def _collect_error_types() -> set[type]:
    seen: set[type] = set()
    stack: list[type] = [err.StemmaError]
    while stack:
        cls = stack.pop()
        if cls is not err.StemmaError:
            seen.add(cls)
        stack.extend(cls.__subclasses__())
    return seen


_REQUEST_ADAPTERS: dict[str, TypeAdapter[Any]] = {
    cls.__name__: TypeAdapter(cls) for cls in get_args(req.Request)
}
_RESPONSE_ADAPTERS: dict[type, TypeAdapter[Any]] = {
    cls: TypeAdapter(cls) for cls in get_args(resp.Response)
}
_ERROR_ADAPTERS: dict[type, TypeAdapter[Any]] = {
    cls: TypeAdapter(cls) for cls in _collect_error_types()
}


def decode_request(payload: dict[str, Any]) -> req.Request:
    tag, fields_dict = _unwrap_envelope(payload, "request")
    adapter = _REQUEST_ADAPTERS.get(tag)
    if adapter is None:
        raise ValueError(f"unknown request type {tag!r}")
    return adapter.validate_python(fields_dict)


def encode_response(response: resp.Response) -> dict[str, Any]:
    return _wrap_envelope(response, _RESPONSE_ADAPTERS[type(response)])


def encode_error(error: err.StemmaError) -> dict[str, Any]:
    return _wrap_envelope(error, _ERROR_ADAPTERS[type(error)])


def _wrap_envelope(value: Any, adapter: TypeAdapter[Any]) -> dict[str, Any]:
    return {type(value).__name__: adapter.dump_python(value, by_alias=True, mode="json")}


def _unwrap_envelope(value: Any, what: str) -> tuple[str, dict[str, Any]]:
    if not isinstance(value, dict) or len(value) != 1:
        raise ValueError(f"expected single-key tagged object for {what}, got {value!r}")
    [(tag, fields_dict)] = value.items()
    return tag, fields_dict
