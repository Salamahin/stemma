// Selectors of add relation modal ============================================================================
$('#addRelationModal').on('show.bs.modal', event => {
    $('#sourcePersonSelector').children().remove().end();
    $('#targetPersonSelector').children().remove().end();
    $.each(graph.people(), function(key, value) {
      if(value.type == 'person') {
        $('#sourcePersonSelector').append($("<option></option>").attr("value", value.id).text(value.name));
        $('#targetPersonSelector').append($("<option></option>").attr("value", value.id).text(value.name));
      }
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


// Keyboard shortcuts =========================================================
$(document).keyup(event => {
    if(!event.shiftKey && event.keyCode == 32) {
        $('#addPersonModal').modal('show');
        event.stopPropagation();
        event.preventDefault();
    }
});
$(document).keyup(event => {
    if(event.shiftKey && event.keyCode == 32) {
        $('#addRelationModal').modal('show');
        event.stopPropagation();
        event.preventDefault();
    }
});

$(document).keydown(event => {
    if (event.altKey && event.key === "1") {
        $('#addChild').click();
    }
    if (event.altKey && event.key === "2") {
        $('#addSpouse').click();
    }
    if (event.altKey && event.key === "3") {
        $('#addParent').click();
    }
});
// =============================================================================


// Init states ============================================
$(() => {
    $('[data-toggle="tooltip"]').tooltip()
});
// ========================================================