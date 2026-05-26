import { LocalizedError } from "./i18n";
import type { StemmaResponse } from "./model";

export function mapStemmaError<T extends StemmaResponse>(response: T, describePerson: (id: string) => string): T {
    switch (response.type) {
        case "UnknownError":
            throw new LocalizedError("error.unknown")
        case "RequestDeserializationProblem":
            throw new LocalizedError("error.invalidRequest")
        case "NoSuchPersonId":
            throw new LocalizedError("error.noSuchPerson", { name: describePerson(response.id) })
        case "ChildAlreadyBelongsToFamily":
            throw new LocalizedError("error.childAlreadyHasParents", { name: describePerson(response.personId) })
        case "IncompleteFamily":
            throw new LocalizedError("error.incompleteFamily")
        case "DuplicatedIds":
            throw new LocalizedError("error.duplicatedIds", { name: describePerson(response.duplicatedIds) })
        case "AccessToFamilyDenied":
            throw new LocalizedError("error.accessToFamilyDenied")
        case "AccessToPersonDenied":
            throw new LocalizedError("error.accessToPersonDenied", { name: describePerson(response.personId) })
        case "AccessToStemmaDenied":
            throw new LocalizedError("error.accessToStemmaDenied")
        case "InvalidInviteToken":
            throw new LocalizedError("error.invalidInviteToken")
        case "ForeignInviteToken":
            throw new LocalizedError("error.foreignInviteToken")
        case "StemmaHasCycles":
            throw new LocalizedError("error.stemmaHasCycles")
        case "UnsupportedPhotoType":
            throw new LocalizedError("error.unsupportedPhotoType")
        default:
            return response
    }
}
