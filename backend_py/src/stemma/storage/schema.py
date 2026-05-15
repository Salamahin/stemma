from sqlalchemy import (
    BigInteger,
    Column,
    Date,
    ForeignKey,
    Identity,
    MetaData,
    PrimaryKeyConstraint,
    String,
    Table,
)

metadata = MetaData()

stemma_users = Table(
    "StemmaUsers",
    metadata,
    Column("id", BigInteger, Identity(always=False), primary_key=True),
    Column("email", String, nullable=False, unique=True),
)

stemmas = Table(
    "Stemma",
    metadata,
    Column("id", BigInteger, Identity(always=False), primary_key=True),
    Column("name", String, nullable=False),
)

people = Table(
    "Person",
    metadata,
    Column("id", BigInteger, Identity(always=False), primary_key=True),
    Column("name", String, nullable=False),
    Column("birthDate", Date),
    Column("deathDate", Date),
    Column("bio", String),
    Column("stemmaId", BigInteger, ForeignKey("Stemma.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False),
)

families = Table(
    "Family",
    metadata,
    Column("id", BigInteger, Identity(always=False), primary_key=True),
    Column("stemmaId", BigInteger, ForeignKey("Stemma.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False),
)

family_owners = Table(
    "FamilyOwner",
    metadata,
    Column("ownerId", BigInteger, ForeignKey("StemmaUsers.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False),
    Column("familyId", BigInteger, ForeignKey("Family.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False),
    PrimaryKeyConstraint("ownerId", "familyId", name="PK_FamilyOwner"),
)

person_owners = Table(
    "PersonOwner",
    metadata,
    Column("ownerId", BigInteger, ForeignKey("StemmaUsers.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False),
    Column("personId", BigInteger, ForeignKey("Person.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False),
    PrimaryKeyConstraint("ownerId", "personId", name="PK_PersonOwner"),
)

stemma_owners = Table(
    "StemmaOwner",
    metadata,
    Column("ownerId", BigInteger, ForeignKey("StemmaUsers.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False),
    Column("stemmaId", BigInteger, ForeignKey("Stemma.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False),
    PrimaryKeyConstraint("ownerId", "stemmaId", name="PK_StemmaOwner"),
)

spouses = Table(
    "Spouse",
    metadata,
    Column("personId", BigInteger, ForeignKey("Person.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False),
    Column("familyId", BigInteger, ForeignKey("Family.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False),
    PrimaryKeyConstraint("personId", "familyId", name="PK_Spouse"),
)

children = Table(
    "Child",
    metadata,
    Column("personId", BigInteger, ForeignKey("Person.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False),
    Column("familyId", BigInteger, ForeignKey("Family.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False),
    PrimaryKeyConstraint("personId", "familyId", name="PK_Child"),
)
