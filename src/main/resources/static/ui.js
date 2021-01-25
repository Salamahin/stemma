// Selectors of add relation modal ============================================================================
$('#addRelationModal').on('show.bs.modal', event => {
    $('#sourceKinsmanSelector').children().remove().end();
    $('#targetKinsmanSelector').children().remove().end();
    $.each(dataVertexes, function(key, value) {
      if(value.type == 'person') {
        $('#sourceKinsmanSelector').append($("<option></option>").attr("value", value.id).text(value.name));
        $('#targetKinsmanSelector').append($("<option></option>").attr("value", value.id).text(value.name));
      }
    });
});

function disableSelfReference() {
    const sourceKinsmanId = $('#sourceKinsmanSelector').val();
    const targetKinsmanId = $('#targetKinsmanSelector').val();
    if(sourceKinsmanId == targetKinsmanId) {
        $('#addChild').attr('disabled', true);
        $('#addSpouse').attr('disabled', true);
        $('#addParent').attr('disabled', true);
    } else {
        $('#addChild').removeAttr('disabled');
        $('#addSpouse').removeAttr('disabled');
        $('#addParent').removeAttr('disabled');
    }
}

$('#sourceKinsmanSelector').on('select2:select', disableSelfReference);
$('#targetKinsmanSelector').on('select2:select', disableSelfReference);

$('#sourceKinsmanSelector').select2({ theme: 'bootstrap4' });
$('#targetKinsmanSelector').select2({ theme: 'bootstrap4' });
// ============================================================================================================


// Keyboard shortcuts =========================================================
$(document).keyup(event => {
    if(!event.shiftKey && event.keyCode == 32) {
        $('#addKinsmanModal').modal('show');
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
drawGraph();
$(() => {
  $('[data-toggle="tooltip"]').tooltip()
});
// ========================================================