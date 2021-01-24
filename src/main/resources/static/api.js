function stringify(obj) {
    return JSON.stringify(
        obj,
        function (key, value) { return (value === "") ? undefined : value }
    );
}

$('#submitKinsman').click(function(e) {
    e.preventDefault();
    async function callAddKinsmanService() {
        const newKinsman = {
            name: $('#name').val(),
            birthDate: $('#birthDate').val(),
            deathDate: $("#deathDate").val()
        };

        const response = await fetch(
            '/api/kinsman',
             {
                method: 'POST',
                body: stringify(newKinsman)
             }
        );
        const kinsmanId = await response.json();
        return kinsmanId;
    }

    callAddKinsmanService().then(kinsmenId => console.log(kinsmenId));
});
