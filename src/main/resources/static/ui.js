const graph = new stemma("#data_viz");

function updateStemma(stemma) {
    stemma.people.forEach(graph.addPerson);
    stemma.families.forEach(graph.addFamily);
    stemma.children.forEach(graph.addChild);
    stemma.spouses.forEach(graph.addSpouse);
}

async function createOrUpdateFamily(personName, spouseName, childrenNames) {
    const personId = await callAddPersonService(personName);
    const childrenIds = await Promise.all(childrenNames.map(childName => callAddPersonService(childName)));
    await Promise.all(childrenIds.map(childId => callAddChildService(personId, childId)));

    if(spouseName != null && spouseName != "") {
        const spouseId = await callAddPersonService(spouseName);
        await callAddSpouseService(personId, spouseId);
        await Promise.all(childrenIds.map(childId => callAddChildService(spouseId, childId)));
    }

    const stemma = await callGetStemmaService();
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
    $('#updatePersonModal').modal('show');
})


$(document).ready(function() {
    callGetStemmaService().then(updateStemma)
});