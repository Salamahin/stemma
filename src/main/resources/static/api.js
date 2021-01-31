function stringify(obj) {
    return JSON.stringify(
        obj,
        function (key, value) { return (value === "") ? undefined : value }
    );
}

async function callAddPersonService(name, birthDate, deathDate) {
    const newPerson = { name: name, birthDate: birthDate, deathDate: deathDate };

    const response = await fetch(
        '/api/person',
         {
            method: 'POST',
            body: stringify(newPerson)
         }
    );

    return await response.json();
}

async function callUpdatePersonService(uuid, newName, newBirthDate, newDeathDate) {
    const person = { name: newName, birthDate: newBirthDate, deathDate: newDeathDate };

    await fetch(
        '/api/person/' + uuid,
         {
            method: 'POST',
            body: stringify(person)
         }
    );
}

async function callRemovePersonService(uuid) {
   await fetch(
        '/api/person/' + uuid,
         {
            method: 'DELETE'
         }
   );
}

async function callAddSpouseService(partner1Id, partner2Id) {
    const newSpouse = { partner1Id: partner1Id, partner2Id: partner2Id };

    const response = await fetch(
        '/api/spouse',
         {
            method: 'POST',
            body: stringify(newSpouse)
         }
    );

    return await response.json();
}

async function callAddChildService(parentId, childId) {
    const newChild = { parentId: parentId, childId: childId };
    console.log(newChild);

    const response = await fetch(
        '/api/child',
         {
            method: 'POST',
            body: stringify(newChild)
         }
    );

    return await response.json();
}

async function callGetStemmaService() {
    const response = await fetch('/api/stemma');
    const json = await response.json();
    return json;
}

