$(document).ready(function () {
    $.ajax({
        type: 'get',
        url: '/getDepartures',
        success: function (data) {
            $.each(data, function (key, value) {
                for (var i = 0; i < value.length; i++) {
                    $('#from')
                        .append($("<option></option>")
                            .attr("value", value[i].code)
                            .text(value[i].name));
                }
            });
        }
    });

    $.ajax({
        type: 'get',
        url: '/getDestinations/',
        success: function (data) {
            $.each(data, function (key, value) {
                for (var i = 0; i < value.length; i++) {
                    console.log(value[i]);
                    $('#to')
                        .append($("<option></option>")
                            .attr("value", value[i].code)
                            .text(value[i].name));
                }
            });
        }
    });

    $('#from').on('change', function () {
        $("#to").empty();
        $.ajax({
            type: 'get',
            url: '/getDestinations/' + this.value,
            success: function (data) {
                $.each(data, function (key, value) {
                    for (var i = 0; i < value.length; i++) {
                        console.log(value[i]);
                        $('#to')
                            .append($("<option></option>")
                                .attr("value", value[i].code)
                                .text(value[i].name));
                    }
                });
            }
        });
    });

    var $document = $(document),
    $element = $('#test'),
    className = 'opacity-max';
    console.log($element);
    $document.scroll(function() {
        if ($document.scrollTop() >= 60) {
            console.log("sup");
            $element.addClass(className);
            console.log("ajouté");
            console.log($element);

        } else {
           $element.removeClass(className);
        }
    });

});
