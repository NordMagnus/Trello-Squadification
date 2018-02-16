// var tdom = {
//     helloWorld: function() {
//         return "Hi!";
//     }
// }

(function (factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        define(['jquery'], factory);
    } else {
        factory(jQuery);
    }
}(function ($) {
    'use strict';
    return {
        helloWorld: function() {
            return "Hi!";
        }
    }
}));
