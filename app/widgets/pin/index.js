'use strict';

const Ractive = require('lib/ractive');
const { translate } = require('lib/i18n');
const CS = require('lib/wallet');
const showLegacyTouchId = require('lib/legacy-touch-id');

function open(options, callback) {

  const header = options.header || translate('Enter your PIN');
  const headerLoading = options.headerLoading || translate('Verifying PIN');
  // eslint-disable-next-line max-len
  const legacyTouchIdIsAvailable = CS.getPinDEPRECATED() && CS.walletExistsDEPRECATED() && window.legacyTouchIdIsAvailable;
  const fidoTouchIdIsAvailable = !!window.localStorage.getItem('_cs_touchid_enabled');

  const ractive = new Ractive({
    el: document.getElementById('general-purpose-overlay'),
    template: require('./index.ract'),
    data: {
      header,
      isLoading: false,
      isWrong: false,
      isOpen: false,
      description: '',
      pin: '',
      backLabel: options.backLabel || translate('Back'),
      touchId: options.touchId && (legacyTouchIdIsAvailable || fidoTouchIdIsAvailable),
      enter(number) {
        const pin = this.get('pin');
        if (pin.length === 4) return;
        this.set('pin', pin + number);
      },
    },
    oncomplete() {
      const $pinInput = ractive.find('.js-pin-input');
      if ($pinInput) $pinInput.focus();
      this.set('isOpen', true);
    },
    onteardown() {
      this.set('isOpen', false);
    },
  });

  ractive.observe('pin', (pin) => {
    pin = pin.trim();
    if (pin.length === 4) {
      ractive.set('isLoading', true);
      ractive.set('header', headerLoading);
      callback(pin);
    }
  });

  ractive.on('backspace', () => {
    if (ractive.get('isLoading')) return;
    const pin = ractive.get('pin').trim();
    if (pin.length === 0 || pin.length === 4) return;
    ractive.set('pin', pin.substr(0, pin.length - 1));
  });

  ractive.on('touch-id', () => {
    if (ractive.get('isLoading')) return;

    if (fidoTouchIdIsAvailable) {
      // FIDO touch id
      return;
    }

    if (legacyTouchIdIsAvailable) {
      return showLegacyTouchId().then(() => {
        ractive.set('pin', CS.getPinDEPRECATED());
      }).catch(() => {
        const $pinInput = ractive.find('.js-pin-input');
        if ($pinInput) $pinInput.focus();
      });
    }
  });

  ractive.on('back', () => {
    if (ractive.get('isLoading')) return;
    ractive.close();
  });

  ractive.wrong = (error) => {
    ractive.set('isLoading', false);
    ractive.set('isWrong', true);
    ractive.set('header', header);
    ractive.set('description', error && translate(error));
    ractive.set('pin', '').then(() => {
      const $pinInput = ractive.find('.js-pin-input');
      if ($pinInput) $pinInput.blur();
      if ($pinInput) $pinInput.focus();
    });
    setTimeout(() => {
      ractive.set('isWrong', false);
    }, 700);
  };

  ractive.close = () => {
    ractive.set('isOpen', false);
    setTimeout(() => {
      ractive.teardown();
    }, 300);
  };

  return ractive;
}

module.exports = open;