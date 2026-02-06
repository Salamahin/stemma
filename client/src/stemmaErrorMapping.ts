import { LocalizedError } from "./i18n";

type ErrorResponse = {
    UnknownError?: { cause: string }
    RequestDeserializationProblem?: { descr: string }
    NoSuchPersonId?: { id: string }
    ChildAlreadyBelongsToFamily?: { familyId: string, personId: string }
    IncompleteFamily?: {}
    DuplicatedIds?: { duplicatedIds: string }
    AccessToFamilyDenied?: { familyId: string }
    AccessToPersonDenied?: { personId: string }
    AccessToStemmaDenied?: { stemmaId: string }
    InvalidInviteToken?: {}
    ForeignInviteToken?: {}
    StemmaHasCycles?: {}
};

export function mapStemmaError<T extends ErrorResponse>(response: T, describePerson: (id: string) => string) {
    if (response.UnknownError) throw new LocalizedError("error.unknown")
    if (response.RequestDeserializationProblem) throw new LocalizedError("error.invalidRequest")
    if (response.NoSuchPersonId) throw new LocalizedError("error.noSuchPerson", { name: describePerson(response.NoSuchPersonId.id) })
    if (response.ChildAlreadyBelongsToFamily) {
        throw new LocalizedError("error.childAlreadyHasParents", { name: describePerson(response.ChildAlreadyBelongsToFamily.personId) })
    }
    if (response.IncompleteFamily) throw new LocalizedError("error.incompleteFamily")
    if (response.DuplicatedIds) {
        throw new LocalizedError("error.duplicatedIds", { name: describePerson(response.DuplicatedIds.duplicatedIds) })
    }
    if (response.AccessToFamilyDenied) throw new LocalizedError("error.accessToFamilyDenied")
    if (response.AccessToPersonDenied) {
        throw new LocalizedError("error.accessToPersonDenied", { name: describePerson(response.AccessToPersonDenied.personId) })
    }
    if (response.AccessToStemmaDenied) throw new LocalizedError("error.accessToStemmaDenied")
    if (response.InvalidInviteToken) throw new LocalizedError("error.invalidInviteToken")
    if (response.ForeignInviteToken) throw new LocalizedError("error.foreignInviteToken")
    if (response.StemmaHasCycles) throw new LocalizedError("error.stemmaHasCycles")

    return response
}
