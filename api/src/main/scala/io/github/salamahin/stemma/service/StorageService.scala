package io.github.salamahin.stemma.service
import io.github.salamahin.stemma.domain.{Stemma => DomainStemma, _}
import io.github.salamahin.stemma.storage.Tables
import slick.interop.zio.DatabaseProvider
import zio._

import scala.collection.mutable
import scala.concurrent.ExecutionContext

case class ChownEffect(affectedFamilies: Seq[String], affectedPeople: Seq[String])

trait StorageService {
  def createSchema: Task[Unit]
  def getOrCreateUser(email: String): IO[StemmaError, User]
  def createStemma(userId: String, name: String): IO[StemmaError, String]
  def listOwnedStemmas(userId: String): IO[StemmaError, Seq[StemmaDescription]]
  def removeStemma(userId: String, stemmaId: String): IO[StemmaError, Unit]
  def createFamily(userId: String, stemmaId: String, family: CreateFamily): IO[StemmaError, (DomainStemma, FamilyDescription)]
  def updateFamily(userId: String, familyId: String, family: CreateFamily): IO[StemmaError, (DomainStemma, FamilyDescription)]
  def removePerson(userId: String, personId: String): IO[StemmaError, Unit]
  def removeFamily(userId: String, familyId: String): IO[StemmaError, Unit]
  def updatePerson(userId: String, personId: String, description: CreateNewPerson): IO[StemmaError, Unit]
  def stemma(userId: String, stemmaId: String): IO[StemmaError, DomainStemma]
  def chown(userId: String, stemmaId: String, targetPersonId: String): IO[StemmaError, ChownEffect]
  def ownsPerson(userId: String, personId: String): IO[StemmaError, Boolean]
  def cloneStemma(userId: String, stemmaId: String, newStemmaName: String): IO[StemmaError, DomainStemma]
}

object StorageService {
  val live: URLayer[DatabaseProvider, StorageService] = ZLayer.fromZIO {
    for {
      db <- ZIO.service[DatabaseProvider]
      repo <- db.profile.map { profile =>
               import profile.api._
               import slick.interop.zio.syntax._
               import Tables._

               val dbLayer = ZLayer.succeed(db)

               new StorageService {
                 override def getOrCreateUser(email: String): IO[StemmaError, User] =
                   ZIO
                     .fromDBIO { implicit ec =>
                       val userId = qStemmaUsers returning qStemmaUsers.map(_.id)

                       (for {
                         maybeUserId <- qStemmaUsers.filter(_.email === email).map(_.id).result.headOption
                         userId      <- maybeUserId.map(id => DBIO.successful(id)).getOrElse(userId += StemmaUser(email = email))
                       } yield User(userId.toString, email)).transactionally
                     }
                     .mapError(t => UnknownError(t))
                     .provideSome(dbLayer)

                 private def checkStemmaAccess(stemmaId: Long, userId: Long)(implicit ec: ExecutionContext) = {
                   val ownedStemma = qStemmaOwners.filter(so => so.ownerId === userId && so.stemmaId === stemmaId)

                   for {
                     isOwner <- ownedStemma.exists.result
                     _       <- if (isOwner) DBIO.successful((): Unit) else DBIO.failed(AccessToStemmaDenied(stemmaId.toString))
                   } yield ()
                 }

                 private def checkPersonAccess(personId: Long, userId: Long)(implicit ec: ExecutionContext) = {
                   val ownedPeople = qPeopleOwners.filter(po => po.ownerId === userId && po.personId === personId)

                   for {
                     isOwner <- ownedPeople.exists.result
                     _       <- if (isOwner) DBIO.successful((): Unit) else DBIO.failed(AccessToPersonDenied(personId.toString))
                   } yield ()
                 }

                 private def checkFamilyAccess(familyId: Long, userId: Long)(implicit ec: ExecutionContext) = {
                   val ownedPeople = qFamiliesOwners.filter(fo => fo.ownerId === userId && fo.familyId === familyId)

                   for {
                     isOwner <- ownedPeople.exists.result
                     _       <- if (isOwner) DBIO.successful((): Unit) else DBIO.failed(AccessToFamilyDenied(familyId.toString))
                   } yield ()
                 }

                 private def checkPersonBelongsToStemma(personId: Long, stemmaId: Long)(implicit ec: ExecutionContext) = {
                   for {
                     personExists <- qPeople.filter(p => p.id === personId && p.stemmaId === stemmaId).exists.result
                     _            <- if (personExists) DBIO.successful((): Unit) else DBIO.failed(NoSuchPersonId(personId.toString))
                   } yield ()
                 }

                 override def createStemma(userId: String, name: String): UIO[String] =
                   ZIO
                     .fromDBIO { implicit ec => makeNewStemma(userId.toLong, name).map(_.toString) }
                     .orDie
                     .provideSome(dbLayer)

                 private def makeNewStemma(userId: Long, name: String)(implicit ec: ExecutionContext) = {
                   for {
                     newStemmaId <- (qStemmas returning qStemmas.map(_.id)) += Stemma(name = name)
                     _           <- qStemmaOwners += StemmaOwner(userId, newStemmaId)
                   } yield newStemmaId
                 }

                 override def listOwnedStemmas(userId: String): IO[StemmaError, Seq[StemmaDescription]] =
                   ZIO
                     .fromDBIO { implicit ec =>
                       val ownedStemmas = qStemmaOwners.filter(_.ownerId === userId.toLong).map(_.stemmaId)

                       val ownersCounted = (ownedStemmas join qStemmaOwners on (_ === _.stemmaId))
                         .groupBy(_._1)
                         .map {
                           case (stemmaId, owners) => (stemmaId, owners.map(_._2.ownerId).size)
                         }

                       (qStemmas join ownersCounted on ((l, r) => l.id === r._1))
                         .map {
                           case (stemma, (_, numberOwners)) => (stemma.id, stemma.name, numberOwners === 1)
                         }
                         .result
                         .map(_.map {
                           case (id, name, removable) => StemmaDescription(id.toString, name, removable)
                         })
                     }
                     .mapError(t => UnknownError(t))
                     .provideSome(dbLayer)

                 override def removeStemma(userId: String, stemmaId: String): IO[StemmaError, Unit] =
                   ZIO
                     .fromDBIO { implicit ec =>
                       val isOnlyOwner = qStemmaOwners
                         .filter(_.stemmaId === stemmaId.toLong)
                         .groupBy(_.stemmaId)
                         .map {
                           case (_, groups) => groups.length === 1
                         }

                       val query = (for {
                         _           <- checkStemmaAccess(stemmaId.toLong, userId.toLong)
                         singleOwner <- isOnlyOwner.result.map(_.head)
                         _           <- if (singleOwner) DBIO.successful((): Unit) else DBIO.failed(IsNotTheOnlyStemmaOwner(stemmaId))

                         _ <- qStemmas.filter(_.id === stemmaId.toLong).delete
                       } yield ()).transactionally

                       query
                     }
                     .refineOrDie {
                       case stemmaError: StemmaError => stemmaError
                     }
                     .provideSome(dbLayer)

                 private def getOrCreatePerson(stemmaId: Long, userId: Long, pd: PersonDefinition)(implicit ec: ExecutionContext) = pd match {
                   case ExistingPerson(id) =>
                     for {
                       _ <- checkPersonAccess(id.toLong, userId)
                       _ <- checkPersonBelongsToStemma(id.toLong, stemmaId)
                     } yield id.toLong

                   case CreateNewPerson(name, birthDate, deathDate, bio) =>
                     for {
                       newPersonId <- (qPeople returning qPeople.map(_.id)) += Person(
                                       name = name,
                                       birthDate = birthDate,
                                       deathDate = deathDate,
                                       bio = bio,
                                       stemmaId = stemmaId
                                     )
                       _ <- qPeopleOwners += PersonOwner(userId, newPersonId)
                     } yield newPersonId
                 }

                 private def linkFamilyMembers(userId: Long, stemmaId: Long, familyId: Long, family: CreateFamily)(implicit ec: ExecutionContext) = {
                   val parents  = (family.parent1 ++ family.parent2).toList
                   val children = family.children

                   val familyIsComplete = if ((parents.size + children.size) < 2) DBIO.failed(IncompleteFamily()) else DBIO.successful((): Unit)
                   val noDuplicatedIds = (parents ++ children)
                     .collect { case ExistingPerson(id) => id }
                     .groupBy(identity)
                     .values
                     .find(_.size > 1)
                     .map(ids => DBIO.failed(DuplicatedIds(ids.head)))
                     .getOrElse(DBIO.successful((): Unit))

                   def createChildRelationIfThereAreNoOtherFamilies(personId: Long) =
                     for {
                       childFamilies <- qChildren.filter(_.personId === personId).map(_.familyId).result
                       _ <- if (childFamilies.isEmpty) qChildren += Child(personId, familyId)
                           else if (childFamilies.size == 1 && childFamilies.head == familyId) DBIO.successful((): Unit)
                           else DBIO.failed(ChildAlreadyBelongsToFamily(childFamilies.find(_ != familyId).get.toString, personId.toString))
                     } yield ()

                   for {
                     _  <- familyIsComplete
                     _  <- noDuplicatedIds
                     ps <- DBIO sequence parents.map(p => getOrCreatePerson(stemmaId, userId, p))
                     cs <- DBIO sequence children.map(p => getOrCreatePerson(stemmaId, userId, p))
                     _  <- DBIO sequence ps.map(p => createSpouseRelationIfNotExist(Spouse(p, familyId)))
                     _  <- DBIO sequence cs.map(createChildRelationIfThereAreNoOtherFamilies)
                   } yield FamilyDescription(familyId.toString, ps.map(_.toString), cs.map(_.toString), true)
                 }

                 private def unlinkFamilyMembers(familyId: Long)(implicit ec: ExecutionContext) =
                   for {
                     _ <- qSpouses.filter(_.familyId === familyId).delete
                     _ <- qChildren.filter(_.familyId === familyId).delete
                   } yield ()

                 private def tryFindMatchingFamily(parents: Seq[PersonDefinition], userId: Long)(implicit ec: ExecutionContext) = {
                   val existingParentsIds = parents.collect {
                     case ExistingPerson(id) => id.toLong
                   }

                   def personFamilies(pId: Long, allPIds: Set[Long]) =
                     (qSpouses.filter(_.personId === pId).map(_.familyId) join qSpouses on (_ === _.familyId))
                       .result
                       .map { families =>
                         families
                           .map {
                             case (fid, spouse) => (fid, spouse.personId)
                           }
                           .groupBy(_._1)
                           .collectFirst {
                             case (fId, f) if f.map(_._2).toSet == allPIds => fId
                           }
                       }

                   if (parents.isEmpty || parents.size != existingParentsIds.size) DBIO.successful(None)
                   else
                     for {
                       maybeFamilyId <- personFamilies(existingParentsIds.head, existingParentsIds.toSet)
                       _             <- if (maybeFamilyId.nonEmpty) checkFamilyAccess(maybeFamilyId.get, userId) else DBIO.successful((): Unit)
                     } yield maybeFamilyId
                 }

                 override def createFamily(userId: String, stemmaId: String, family: CreateFamily): IO[StemmaError, (DomainStemma, FamilyDescription)] =
                   ZIO
                     .fromDBIO { implicit ec =>
                       def createNewFamily =
                         for {
                           fid <- (qFamilies returning qFamilies.map(_.id)) += Family(stemmaId = stemmaId.toLong)
                           _   <- qFamiliesOwners += FamilyOwner(userId.toLong, fid)
                         } yield fid

                       val query = (for {
                         _             <- checkStemmaAccess(stemmaId.toLong, userId.toLong)
                         maybeFamilyId <- tryFindMatchingFamily((family.parent1 ++ family.parent2).toSeq, userId.toLong)
                         familyId      <- maybeFamilyId.map(DBIO.successful).getOrElse(createNewFamily)

                         familyDescr <- linkFamilyMembers(userId.toLong, stemmaId.toLong, familyId, family)

                         stemma <- describeStemma(userId.toLong, stemmaId.toLong)
                         _      <- if (new StemmaDFS(stemma).hasCycles()) DBIO.failed(StemmaHasCycles()) else DBIO.successful()
                       } yield (stemma, familyDescr)).transactionally

                       query
                     }
                     .mapError {
                       case stemmaError: StemmaError => stemmaError
                       case t                        => UnknownError(t)
                     }
                     .provideSome(dbLayer)

                 override def updateFamily(userId: String, familyId: String, family: CreateFamily): IO[StemmaError, (DomainStemma, FamilyDescription)] =
                   ZIO
                     .fromDBIO { implicit ec =>
                       val query = (for {
                         _ <- checkFamilyAccess(familyId.toLong, userId.toLong)
                         _ <- unlinkFamilyMembers(familyId.toLong)

                         stemmaId    <- qFamilies.filter(_.id === familyId.toLong).map(_.stemmaId).result.head
                         familyDescr <- linkFamilyMembers(userId.toLong, stemmaId, familyId.toLong, family)

                         stemma <- describeStemma(userId.toLong, stemmaId)
                         _      <- if (new StemmaDFS(stemma).hasCycles()) DBIO.failed(StemmaHasCycles()) else DBIO.successful()
                       } yield (stemma, familyDescr)).transactionally

                       query
                     }
                     .mapError {
                       case stemmaError: StemmaError => stemmaError
                       case t                        => UnknownError(t)
                     }
                     .provideSome(dbLayer)

                 override def removePerson(userId: String, personId: String): IO[StemmaError, Unit] =
                   ZIO
                     .fromDBIO { implicit ec =>
                       def dropEmptyFamilies = {
                         val emptyFamilies = (qSpouses.map(x => (x.familyId, x.personId)) unionAll qChildren.map(x => (x.familyId, x.personId)))
                           .groupBy(_._1)
                           .map {
                             case (q, agg) => (q, agg.length)
                           }
                           .filter(_._2 < 2)
                           .map(_._1)
                           .result

                         emptyFamilies.flatMap(fs => qFamilies.filter(_.id inSet fs).delete)
                       }

                       val query = (for {
                         _ <- checkPersonAccess(personId.toLong, userId.toLong)
                         _ <- qPeople.filter(_.id === personId.toLong).delete
                         _ <- dropEmptyFamilies
                       } yield ()).transactionally

                       query
                     }
                     .mapError {
                       case stemmaError: StemmaError => stemmaError
                       case t                        => UnknownError(t)
                     }
                     .provideSome(dbLayer)

                 override def removeFamily(userId: String, familyId: String): IO[StemmaError, Unit] =
                   ZIO
                     .fromDBIO { implicit ec =>
                       val query = (for {
                         _ <- checkFamilyAccess(familyId.toLong, userId.toLong)
                         _ <- unlinkFamilyMembers(familyId.toLong)
                         _ <- qFamilies.filter(_.id === familyId.toLong).delete
                       } yield ()).transactionally

                       query
                     }
                     .mapError {
                       case stemmaError: StemmaError => stemmaError
                       case t                        => UnknownError(t)
                     }
                     .provideSome(dbLayer)

                 override def updatePerson(userId: String, personId: String, description: CreateNewPerson): IO[StemmaError, Unit] =
                   ZIO
                     .fromDBIO { implicit ec =>
                       val query = (for {
                         _        <- checkPersonAccess(personId.toLong, userId.toLong)
                         stemmaId <- qPeople.filter(_.id === personId.toLong).map(_.stemmaId).result.head
                         _        <- qPeople.insertOrUpdate(Person(personId.toLong, description.name, description.birthDate, description.deathDate, description.bio, stemmaId))
                       } yield ()).transactionally

                       query
                     }
                     .mapError {
                       case stemmaError: StemmaError => stemmaError
                       case t                        => UnknownError(t)
                     }
                     .provideSome(dbLayer)

                 override def cloneStemma(userId: String, stemmaId: String, newStemmaName: String): IO[StemmaError, DomainStemma] =
                   ZIO
                     .fromDBIO { implicit ec =>
                       val query = (for {
                         _                              <- checkStemmaAccess(stemmaId.toLong, userId.toLong)
                         newStemmaId                    <- makeNewStemma(userId.toLong, newStemmaName)
                         DomainStemma(people, families) <- describeStemma(userId.toLong, stemmaId.toLong)
                         newPeopleIds                   <- (qPeople returning qPeople.map(_.id)) ++= people.map(pd => Person(name = pd.name, birthDate = pd.birthDate, deathDate = pd.deathDate, bio = pd.bio, stemmaId = newStemmaId))
                         newPeopleFamilies              <- (qFamilies returning qFamilies.map(_.id)) ++= List.fill(families.size)(Family(stemmaId = newStemmaId))

                         _ <- qPeopleOwners ++= newPeopleIds.map(id => PersonOwner(userId.toLong, id))
                         _ <- qFamiliesOwners ++= newPeopleFamilies.map(id => FamilyOwner(userId.toLong, id))

                         oldToNewPersonId = (people.map(_.id) zip newPeopleIds).toMap
                         oldToNewFamilyId = (families.map(_.id) zip newPeopleFamilies).toMap

                         (spouses, children) = families.map(fd => (fd.id -> fd.parents, fd.id -> fd.children)).unzip

                         spouseFlattened = spouses.flatMap {
                           case (fid, pids) => pids.map(pid => Spouse(oldToNewPersonId(pid), oldToNewFamilyId(fid)))
                         }

                         childrenFlattened = children.flatMap {
                           case (fid, pids) => pids.map(pid => Child(oldToNewPersonId(pid), oldToNewFamilyId(fid)))
                         }

                         _ <- qSpouses ++= spouseFlattened
                         _ <- qChildren ++= childrenFlattened

                       } yield DomainStemma(
                         people.map(pd => pd.copy(id = oldToNewPersonId(pd.id).toString, readOnly = false)),
                         families.map(fd => FamilyDescription(oldToNewFamilyId(fd.id).toString, fd.parents.map(oldToNewPersonId).map(_.toString), fd.children.map(oldToNewPersonId).map(_.toString), false))
                       )).transactionally

                       query
                     }
                     .mapError {
                       case stemmaError: StemmaError => stemmaError
                       case t                        => UnknownError(t)
                     }
                     .provideSome(dbLayer)

                 override def stemma(userId: String, stemmaId: String): IO[StemmaError, DomainStemma] =
                   ZIO
                     .fromDBIO { implicit ec =>
                       val query = for {
                         _      <- checkStemmaAccess(stemmaId.toLong, userId.toLong)
                         stemma <- describeStemma(userId.toLong, stemmaId.toLong)
                       } yield stemma

                       query
                     }
                     .mapError {
                       case stemmaError: StemmaError => stemmaError
                       case t                        => UnknownError(t)
                     }
                     .provideSome(dbLayer)

                 private def describeStemma(userId: Long, stemmaId: Long)(implicit ec: ExecutionContext) = {
                   val fs     = qFamilies.filter(_.stemmaId === stemmaId)
                   val ownedF = qFamiliesOwners.filter(_.ownerId === userId)

                   val parents  = (fs join qSpouses on (_.id === _.familyId) joinLeft ownedF on (_._1.id === _.familyId)).map { case ((f, m), o)  => (f.id, m.personId, o.isEmpty) }
                   val children = (fs join qChildren on (_.id === _.familyId) joinLeft ownedF on (_._1.id === _.familyId)).map { case ((f, m), o) => (f.id, m.personId, o.isEmpty) }

                   for {
                     pp <- (qPeople.filter(_.stemmaId === stemmaId) joinLeft qPeopleOwners.filter(_.ownerId === userId) on (_.id === _.personId)).result
                     ps <- parents.result
                     cs <- children.result
                   } yield {
                     val people = pp.map {
                       case (tp, isOwner) => PersonDescription(tp.id.toString, tp.name, tp.birthDate, tp.deathDate, tp.bio, isOwner.isEmpty)
                     }

                     val familyReadOnly = mutable.Map.empty[String, Boolean]
                     val familySpouses  = mutable.Map.empty[String, mutable.Set[String]].withDefaultValue(mutable.Set.empty)
                     val familyChildren = mutable.Map.empty[String, mutable.Set[String]].withDefaultValue(mutable.Set.empty)

                     ps.groupBy {
                         case (fid, _, _) => fid
                       }
                       .foreach {
                         case (fid, members) =>
                           familySpouses(fid.toString) = familySpouses(fid.toString) ++ members.map(_._2.toString)
                           familyReadOnly(fid.toString) = members.head._3
                       }

                     cs.groupBy {
                         case (fid, _, _) => fid
                       }
                       .foreach {
                         case (fid, members) =>
                           familyChildren(fid.toString) = familyChildren(fid.toString) ++ members.map(_._2.toString)
                           familyReadOnly(fid.toString) = members.head._3
                       }

                     val families = familyReadOnly.map {
                       case (familyId, readOnly) => FamilyDescription(familyId, familySpouses(familyId).toList, familyChildren(familyId).toList, readOnly)
                     }

                     DomainStemma(people.toList, families.toList)
                   }
                 }

                 private def selectKinsmenFamilies(initPersonId: Long) = sql"""
                   WITH RECURSIVE 
                   "FamilyDescr" AS (
                       SELECT coalesce(s."personId", c."personId") AS "personId", s."familyId" AS "childFamily", c."familyId" AS "parentFamily"
                       FROM "Spouse" s FULL JOIN "Child" c on s."personId" = c."personId"
                   ), 
                   "Ancestors" AS (
                     SELECT "personId", "childFamily", "parentFamily" FROM "FamilyDescr" WHERE "personId" = $initPersonId
                     UNION
                     SELECT fd."personId", fd."childFamily", fd."parentFamily" FROM "FamilyDescr" fd INNER JOIN "Ancestors" anc ON anc."parentFamily" = fd."childFamily"
                   ),
                   "Dependees" AS (
                       SELECT "personId", "childFamily", "parentFamily" FROM "FamilyDescr" WHERE "childFamily" IN (SELECT DISTINCT "parentFamily" FROM "Ancestors" WHERE "parentFamily" IS NOT NULL)
                       UNION
                       SELECT fd."personId", fd."childFamily", fd."parentFamily" FROM "FamilyDescr" fd INNER JOIN "Dependees" dep ON dep."childFamily" = fd."parentFamily"
                   ) SELECT DISTINCT "childFamily" AS familyId FROM "Dependees" WHERE "childFamily" IS NOT NULL
                   """.as[Long]

                 // ==================================================================================================================
                 //for some reason slick compiles an incorrect query when insertOrUpdate on the table where all the columns are
                 //composite key, so this a way how to overcome the problem
                 //see https://github.com/slick/slick/issues/2207
                 private def addOwnerIfNeeded(ow: FamilyOwner)(implicit ec: ExecutionContext) =
                   for {
                     exists <- qFamiliesOwners.filter(fo => fo.ownerId === ow.ownerId && fo.familyId === ow.resourceId).exists.result
                     _      <- if (!exists) qFamiliesOwners += ow else DBIO.successful((): Unit)
                   } yield ()

                 private def addOwnerIfNeeded(ow: PersonOwner)(implicit ec: ExecutionContext) =
                   for {
                     exists <- qPeopleOwners.filter(po => po.ownerId === ow.ownerId && po.personId === ow.resourceId).exists.result
                     _      <- if (!exists) qPeopleOwners += ow else DBIO.successful((): Unit)
                   } yield ()

                 private def addOwnerIfNeeded(ow: StemmaOwner)(implicit ec: ExecutionContext) =
                   for {
                     exists <- qStemmaOwners.filter(po => po.ownerId === ow.ownerId && po.stemmaId === ow.resourceId).exists.result
                     _      <- if (!exists) qStemmaOwners += ow else DBIO.successful((): Unit)
                   } yield ()

                 private def createSpouseRelationIfNotExist(spouse: Spouse)(implicit ec: ExecutionContext) =
                   for {
                     exists <- qSpouses.filter(s => s.familyId === spouse.familyId && s.personId === spouse.personId).exists.result
                     _      <- if (!exists) qSpouses += spouse else DBIO.successful((): Unit)
                   } yield ()
                 // ==================================================================================================================

                 override def chown(userId: String, stemmaId: String, targetPersonId: String): IO[StemmaError, ChownEffect] =
                   ZIO
                     .fromDBIO { implicit ec =>
                       val action = (for {
                         kinsmenFamilies <- selectKinsmenFamilies(targetPersonId.toLong)
                         affectedPeople  <- (qSpouses.filter(_.familyId inSet kinsmenFamilies).map(_.personId) union qChildren.filter(_.familyId inSet kinsmenFamilies).map(_.personId)).result
                         _               <- DBIO sequence kinsmenFamilies.map(fid => addOwnerIfNeeded(FamilyOwner(userId.toLong, fid)))
                         _               <- DBIO sequence affectedPeople.map(pid => addOwnerIfNeeded(PersonOwner(userId.toLong, pid)))
                         _               <- addOwnerIfNeeded(StemmaOwner(userId.toLong, stemmaId.toLong))
                       } yield ChownEffect(kinsmenFamilies.map(_.toString), affectedPeople.map(_.toString))).transactionally

                       action
                     }
                     .mapError(t => UnknownError(t))
                     .provideSome(dbLayer)

                 override def ownsPerson(userId: String, personId: String): IO[StemmaError, Boolean] =
                   ZIO
                     .fromDBIO { implicit ec => qPeopleOwners.filter(po => po.ownerId === userId.toLong && po.personId === personId.toLong).exists.result }
                     .mapError(t => UnknownError(t))
                     .provideSome(dbLayer)

                 override def createSchema: Task[Unit] =
                   ZIO
                     .fromDBIO(
                       (qStemmaUsers.schema ++
                         qStemmas.schema ++
                         qPeople.schema ++
                         qFamilies.schema ++
                         qFamiliesOwners.schema ++
                         qPeopleOwners.schema ++
                         qStemmaOwners.schema ++
                         qSpouses.schema ++
                         qChildren.schema).createIfNotExists
                     )
                     .provideSome(dbLayer)
               }
             }
    } yield repo
  }
}
