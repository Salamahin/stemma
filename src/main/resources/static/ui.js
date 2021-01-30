// Selectors of add relation modal ============================================================================
$('#addRelationModal').on('show.bs.modal', event => {
    $('#sourcePersonSelector').children().remove().end();
    $('#targetPersonSelector').children().remove().end();
    $.each(graph.people(), function(key, value) {
        $('#sourcePersonSelector').append($("<option></option>").attr("value", value.id).text(value.name));
        $('#targetPersonSelector').append($("<option></option>").attr("value", value.id).text(value.name));
    });
});

function disableSelfReference() {
    const sourcepersonId = $('#sourcePersonSelector').val();
    const targetpersonId = $('#targetPersonSelector').val();
    if(sourcepersonId == targetpersonId) {
        $('#addChild').attr('disabled', true);
        $('#addSpouse').attr('disabled', true);
        $('#addParent').attr('disabled', true);
    } else {
        $('#addChild').removeAttr('disabled');
        $('#addSpouse').removeAttr('disabled');
        $('#addParent').removeAttr('disabled');
    }
}

$('#sourcePersonSelector').on('select2:select', disableSelfReference);
$('#targetPersonSelector').on('select2:select', disableSelfReference);

$('#sourcePersonSelector').select2({ theme: 'bootstrap4' });
$('#targetPersonSelector').select2({ theme: 'bootstrap4' });
// ============================================================================================================



// Init states ============================================
$(() => {
    $('[data-toggle="tooltip"]').tooltip()
});
// ========================================================


const graph = new stemma("#data_viz");

function updateStemma(stemma) {
    stemma.people.forEach(graph.addPerson);
    stemma.families.forEach(graph.addFamily);
    stemma.children.forEach(graph.addChild);
    stemma.spouses.forEach(graph.addSpouse);
}

$('#createOrUpdate').click(function(e) {
    const name = $('#createOrUpdatePersonSelector').val();
    const birthDate = $('#birthDate').val();
    const deathDate =$("#deathDate").val();
    callAddPersonService(name, birthDate, deathDate)
        .then(() => callGetStemmaService().then(updateStemma))
        .then(() => $('#createOrUpdatePersonSelector').val(""));
});

$('#addChild').click(function(e) {
    const parentId = $('#sourcePersonSelector').val();
    const childId = $('#targetPersonSelector').val();

    callAddChildService(parentId, childId).then(() => callGetStemmaService().then(updateStemma));
});

$('#addSpouse').click(function(e) {
    const partner1Id = $('#sourcePersonSelector').val();
    const partner2Id = $('#targetPersonSelector').val();

    callAddSpouseService(partner1Id, partner2Id).then(() => callGetStemmaService().then(updateStemma));
});

$(document).ready(function() {
    callGetStemmaService().then(updateStemma)
});