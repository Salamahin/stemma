from typing import Any, cast

from pydantic import TypeAdapter

from stemma.domain import errors as err
from stemma.domain import requests as req
from stemma.domain import responses as resp

_REQUEST_ADAPTER: TypeAdapter[req.Request] = TypeAdapter(req.Request)
_RESPONSE_ADAPTER: TypeAdapter[resp.Response] = TypeAdapter(resp.Response)
_ERROR_ADAPTER: TypeAdapter[err.StemmaErrorUnion] = TypeAdapter(err.StemmaErrorUnion)


def decode_request(payload: dict[str, Any]) -> req.Request:
    return _REQUEST_ADAPTER.validate_python(payload)


def encode_response(response: resp.Response) -> dict[str, Any]:
    return _RESPONSE_ADAPTER.dump_python(response, by_alias=True, mode="json")


def encode_error(error: err.StemmaError) -> dict[str, Any]:
    return _ERROR_ADAPTER.dump_python(cast(err.StemmaErrorUnion, error), by_alias=True, mode="json")
