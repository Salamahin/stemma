from pydantic import ConfigDict


def to_camel(name: str) -> str:
    head, *rest = name.split("_")
    return head + "".join(p[:1].upper() + p[1:] for p in rest)


DOMAIN_CONFIG = ConfigDict(alias_generator=to_camel, populate_by_name=True)
