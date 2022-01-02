const graph = new stemma("#data_viz");

function updateStemma(stemma) {
    graph.updateData(stemma.people, stemma.families, stemma.children, stemma.spouses);
}

async function createOrUpdateFamily(personName, spouseName, childrenNames) {
    const personId = await callAddPersonService(personName);
    const childrenIds = await Promise.all(childrenNames.map(childName => callAddPersonService(childName)));

    var spouseId = null;
    if(spouseName != null && spouseName != "") {
        spouseId = await callAddPersonService(spouseName);
    }

    await callAddFamilyService(personId, spouseId, childrenIds);

    const stemma = await callGetStemmaService()
    updateStemma(stemma);
}

$('#commitFamilyButton').click(function(e) {
    const personName = $('#personNameInput').val();
    const spouseName = $('#spouseNameInput').val();
    const childrenNames = [
        $('#child1NameInput').val(),
        $('#child2NameInput').val(),
        $('#child3NameInput').val(),
        $('#child4NameInput').val(),
        $('#child5NameInput').val()
    ].filter(childName => childName != null && childName != "");

    createOrUpdateFamily(personName, spouseName, childrenNames)
        .then(() => {
            $('#addFamilyModal').modal('hide');
            $('#personNameInput').val(null);
            $('#spouseNameInput').val(null);
            $('#child1NameInput').val(null);
            $('#child2NameInput').val(null);
            $('#child3NameInput').val(null);
            $('#child4NameInput').val(null);
            $('#child5NameInput').val(null);
        });
});

$('#btn-download').click(function(e) {
    try {
       var isFileSaverSupported = !!new Blob();
    } catch (e) {
       alert("blob not supported");
    }

    var html = d3.select("svg")
       .attr("title", "test2")
       .attr("version", 1.1)
       .attr("xmlns", "http://www.w3.org/2000/svg")
       .node().parentNode.innerHTML;

    var blob = new Blob([html], {type: "image/svg+xml"});
    saveAs(blob, "stemma.svg");
});

graph.onPersonClicked(d => {
    $('#personOldNameInput').val(d.name);
    $('#personNewNameInput').val(d.name);
    $('#updatePersonButton').click(function(e) {
        const newName = $('#personNewNameInput').val();
        callUpdatePersonService(d.id, newName)
            .then(() => callGetStemmaService())
            .then(stemma => updateStemma)
            .then(() => $('#updatePersonModal').modal('hide'));
    });
    $('#removePersonButton').click(function(e) {
            callRemovePersonService(d.id)
                .then(() => callGetStemmaService())
                .then(stemma => updateStemma(stemma))
                .then(() => $('#updatePersonModal').modal('hide'));
    });
    $('#updatePersonModal').modal('show');
})


$(document).ready(function() {
    callGetStemmaService().then(updateStemma)
});