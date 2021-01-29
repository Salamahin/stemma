function stringify(obj) {
    return JSON.stringify(
        obj,
        function (key, value) { return (value === "") ? undefined : value }
    );
}

async function callAddPersonService() {
    const newPerson = {
        name: $('#createOrUpdatePersonSelector').val(),
        birthDate: $('#birthDate').val(),
        deathDate: $("#deathDate").val()
    };

    const response = await fetch(
        '/api/person',
         {
            method: 'POST',
            body: stringify(newPerson)
         }
    );

    return await response.json();
}

$('#createOrUpdate').click(function(e) {
    e.preventDefault();
    callAddPersonService().then(personId => console.log(personId));
});
