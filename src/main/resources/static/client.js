$("#sidebarCollapse").click(function(e) {
    e.preventDefault();
    $('#sidebar, #content').toggleClass('active');
});

$('#submitKinsman').click(function(e) {
    e.preventDefault();
    (async() => {
        const response = await fetch('/api/kinsman');
        const kinsmen = await response.json();
        console.log(kinsmen);
    })();
})