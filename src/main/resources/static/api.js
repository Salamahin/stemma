function stringify(obj) {
    return JSON.stringify(
        obj,
        function (key, value) { return (value === "") ? undefined : value }
    );
}

$('#submitPerson').click(function(e) {
    e.preventDefault();
    async function callAddpersonService() {
        const newperson = {
            name: $('#name').val(),
            birthDate: $('#birthDate').val(),
            deathDate: $("#deathDate").val()
        };

        const response = await fetch(
            '/api/person',
             {
                method: 'POST',
                body: stringify(newperson)
             }
        );
        const personId = await response.json();
        return personId;
    }

    callAddpersonService().then(kinsmenId => console.log(kinsmenId));
});
