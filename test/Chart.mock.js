/* global define */

(function (factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else {
        return factory();
    }
}(function () {
    'use strict';

    return class Chart {
        constructor(context, info) {
            this.context = context;
            this.data = info.data;
            this.options = info.options;
        }

        /**
         * 
         */
        update() {

        }

    }
}));
