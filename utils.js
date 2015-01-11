var last_values = [],
    refresh_interval = 60000,
    set_interval_id = 0,
    currency = 'cny',
notify = function (title, msg) {
    var date = new Date(),
        hour = date.getHours(),
        minute = date.getMinutes(),
        day = date.getDate(),
        month = date.getMonth() + 1,
        year = date.getFullYear();
    if (minute < 10) {
        minute = '0' + minute;
    }
    if (hour < 10) {
        hour = '0' + hour;
    }
    if (day < 10) {
        day = '0' + day;
    }
    if (month < 10) {
        month = '0' + month;
    }
    var date_str = hour + ':' + minute + ' ' + day + '.' + month + '.' + year;
    return chrome.notifications.create('', {
        type: "basic",
        title: title,
        message: msg,
        contextMessage: date_str,
        iconUrl: "icon.png"
    }, function (notifid) {});
},
get_currency = function() {
    var value = store.get('currency');
    if(value === undefined) {
        return 'cny';
    }
    currency = value;
    return value;
},
get_multiplier = function () {
    var value = store.get('multiplier');
    if (value === undefined) {
        return 1;
    }
    return value;
},
get_last_value = function () {
    return store.get('last-value');
},
get_precision = function () {
    var value = store.get('precision');
    if (value === undefined) {
        return 0;
    }
    return value;
},
get_within = function () {
    return store.get('within') || 10;
},
store_string = function(name, value, default_value) {
    value = String(value);
    if (typeof value !== 'string') {
        value = default_value;
    }
    store.set(name, value);
},
store_float = function (name, value, default_value) {
    value = parseFloat(value);
    if (isNaN(value)) {
        value = default_value;
    }
    store.set(name, value);
},
store_int = function (name, value) {
    value = parseInt(value, 10);
    if (isNaN(value)) {
        value = 1;
    }
    store.set(name, value);
},
_reload_badge = function (value) {
    var last_value = get_last_value() || value,
        last_max = store.get('last-max') || value,
        last_min = store.get('last-min') || value,
        badge_value = value * get_multiplier();
    if (value === last_value) {
        chrome.browserAction.setBadgeBackgroundColor({
            color: [0, 0, 0, 150]
        });
    } else if (value > last_value) {
        chrome.browserAction.setBadgeBackgroundColor({
            color: [0, 150, 0, 150]
        });
    } else {
        chrome.browserAction.setBadgeBackgroundColor({
            color: [255, 0, 0, 255]
        });
    }
    chrome.browserAction.setTitle({
        'title': '1 BTC = ' + value.toFixed(2) + ' ' + currency.toUpperCase()
    });
    chrome.browserAction.setBadgeText({
        'text': badge_value.toFixed(get_precision())
    });
    store_float('last-value', value);
    if (store.get('notification-max') && value > last_max) {
        store.set('last-max', value);
        notify('New maximum BTC price', 'The highest price is now ' + value);
        $('#last_max').val(value);
    }
    if (store.get('notification-min') && value < last_min) {
        store.set('last-min', value);
        notify('New minimum BTC price', 'The lowest price is now ' + value);
        $('#last_min').val(value);
    }
    if (store.get('notification-diff') && store.get('last-diff')) {
        var within = get_within();
        last_values.push(value);
        if (last_values.length > within) {
            last_values.shift();
        }
        var max = Math.max.apply(Math, last_values),
            min = Math.min.apply(Math, last_values),
            abs = Math.round(Math.abs(max - min) * 100) / 100,
            last_diff = store.get('last-diff'),
            title;
        if (abs > last_diff) {
            if (max === value) {
                title = 'Price rose from ' + min + ' to ' + max;
                abs = '+' + abs;
            } else {
                title = 'Price fell from ' + max + ' to ' + min;
                abs = '-' + abs;
            }
            last_values = [value];
            notify(title, 'Within ' + within + ' fetches/minutes price changed ' + abs + ' USD.');
        }
    }
},
reload_badge = function (manual) {
    currency = get_currency();
    if (manual && set_interval_id) {
        clearInterval(set_interval_id);
        set_interval_id = setInterval(reload_badge, refresh_interval);
    }
    $.getJSON('https://data.btcchina.com/data/ticker?market=btccny', function (data) {
        if (!data || !data.ticker || !data.ticker.last) return;

        var cnyPrice = parseFloat(data.ticker.last);
        if (currency === 'cny')
            return _reload_badge(cnyPrice);

        $.ajax({
            url: 'https://currencyconverter.p.mashape.com/',
            type: 'GET',
            data: {
                from: 'CNY',
                from_amount: cnyPrice,
                to: 'USD'
            },
            datatype: 'json',
            success: function (data) {
                if (!data || !data.to_amount) return;
                _reload_badge(data.to_amount);
            },
            beforeSend: function (xhr) {
                xhr.setRequestHeader("X-Mashape-Authorization", "cnLPnEdw2ImshnHkFPSORtgriDPUp18MplVjsn6HfICcGZD5sp"); // Enter your Mashape key here
            }
        });

        $.getJSON('', function(data) {

            _reload_badge(100);
        });
    });
},
save_options = function () {
    currency = $('#currency option:selected').val();

    var multiplier = $('#multiplier').val(),
        precision = $('#precision option:selected').val(),
        within = $('#within option:selected').val(),
        last_max = $('#last_max').val(),
        last_min = $('#last_min').val(),
        last_diff = $('#last_diff').val();

    store_string('currency', currency, 'cny');
    store_float('multiplier', multiplier, 1);
    store_int('precision', precision, 0);
    store_int('within', within, 10);
    store_float('last-max', last_max, get_last_value());
    store_float('last-min', last_min, get_last_value());
    store_float('last-diff', last_diff, 5);
    $('input[type=checkbox]').each(function () {
        var elem = $(this),
            id = elem.attr('id'),
            checked = elem.prop('checked');
        store.set(id, checked);
    });
    load_options();
    reload_badge(1);
},
load_options = function (reload) {
    $('#currency option[value=' + get_currency() + ']').prop('selected', true);
    $('#multiplier').val(get_multiplier());
    $('#precision option[value=' + get_precision() + ']').prop('selected', true);
    $('#within option[value=' + get_within() + ']').prop('selected', true);
    $('input[type=checkbox]').each(function () {
        var elem = $(this),
            id = elem.attr('id'),
            checked = store.get(id);
        elem.prop('checked', checked);
    });
    $('#last_max').val(store.get('last-max') || get_last_value());
    $('#last_min').val(store.get('last-min') || get_last_value());
    $('#last_diff').val(store.get('last-diff') || 5);
    if (reload instanceof Event) $('#save').on('click', save_options);
},
background = function () {
    chrome.browserAction.onClicked.addListener(function (tab) {
        chrome.browserAction.setBadgeBackgroundColor({
            color: [255, 0, 0, 255]
        });
        chrome.browserAction.setBadgeText({
            'text': '...'
        });
        reload_badge(1);
    });
    set_interval_id = setInterval(reload_badge, refresh_interval);
    reload_badge();
};

$(document).ready(function() {
  $.ajaxSetup({
    cache: false
  });
});
