$('#addKinsmanModal').on('show.bs.modal', event => {
    var modalTitle = addKinsmanModal.querySelector('.modal-title');
    var modalBodyInput = addKinsmanModal.querySelector('.modal-body input');


    $('#kinsmanSelector').children().remove().end();
//    $('#kinsmanSelector').focus();
    $.each(dataVertexes, function(key, value) {
      if(value.type == 'person')
          $('#kinsmanSelector').append($("<option></option>").text(value.name));
    });

    $('#kinsmanSelector').focus();
});



// Keyboard shortcuts =========================================================
$(document).keyup(event => {
    if(event.keyCode == 32) {
        $('#addKinsmanModal').modal('show');
    }
});

$(document).keydown(event => {
    if (event.altKey && event.key === "1") {
        console.log("child");
        $('#addChild').click();
    }
    if (event.altKey && event.key === "2") {
            console.log("spouse");
        $('#addSpouse').click();
    }
    if (event.altKey && event.key === "3") {
            console.log("parent");
        $('#addParent').click();
    }
});
// =============================================================================

const dataVertexes = [
    { id: "k1", name: "Голощапов Данила Сергеевич", birtDate: "1990-06-11", type: "person" },
    { id: "k2", name: "Сулерова Ангелина Сергеевна", birtDate: "1991-03-14", type: "person" },
    { id: "k3", name: "Абрамова Светлана Ивановна", type: "person"},
    { id: "k4", name: "Голощапов Сергей Георгиевич", type: "person"},
    { id: "k5", name: "Голощапов Евгения Анатольевна", type: "person"},
    { id: "k6", name: "Голощапов Егор Сергеевич", type: "person"},
    { id: "k7", name: "Голощапов Федор Сергеевич", type: "person"},
    { id: "k8", name: "Голощапова Ольга Сергеевна", type: "person"},
    { id: "k9", name: "Стихова Мария", type: "person"},
    { id: "k10", name: "Зайнулина Мария", type: "person"},
    { id: "k11", name: "Голощапова Ульяна Егоровна", type: "person"},
    { id: "k12", name: "Иван Шмидт", type: "person"},
    { id: "f1", type: "family" },
    { id: "f2", type: "family" },
    { id: "f3", type: "family" },
    { id: "f4", type: "family" },
    { id: "f5", type: "family" },
    { id: "f6", type: "family" }
];


const dataEdges = [
    { id: "1", source: "k1", target: "f1", type: "spouse" },
    { id: "2", source: "k2", target: "f1", type: "spouse" },
    { id: "3", source: "k3", target: "f2", type: "spouse" },
    { id: "4", source: "k4", target: "f3", type: "spouse" },
    { id: "5", source: "k5", target: "f3", type: "spouse" },
    { id: "6", source: "f2", target: "k2", type: "child" },
    { id: "7", source: "f3", target: "k1", type: "child" },
    { id: "8", source: "f3", target: "k6", type: "child" },
    { id: "9", source: "f3", target: "k7", type: "child" },
    { id: "10", source: "f3", target: "k8", type: "child" },
    { id: "15", source: "f5", target: "k11", type: "child" },
    { id: "11", source: "k9", target: "f4", type: "spouse" },
    { id: "12", source: "k7", target: "f4", type: "spouse" },
    { id: "14", source: "k10", target: "f5", type: "spouse" },
    { id: "16", source: "k6", target: "f5", type: "spouse" },
    { id: "17", source: "k12", target: "f6", type: "spouse" },
    { id: "18", source: "k8", target: "f6", type: "spouse" }
];

// Init states ============================================
drawStemma(dataVertexes, dataEdges);
$('#kinsmanSelector').select2({
    theme: 'bootstrap4'
});

$(() => {
  $('[data-toggle="tooltip"]').tooltip()
});
// ========================================================