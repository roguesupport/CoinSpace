'use strict';

const Ractive = require('lib/ractive');
const emitter = require('lib/emitter');
const initHeader = require('widgets/header');
const initTabs = require('widgets/tabs');
const initSettings = require('widgets/settings');
const initSend = require('pages/send');
const initReceive = require('pages/receive');
const initExchange = require('pages/exchange');
const initHistory = require('pages/history');
const initTokens = require('pages/tokens');
const { showError } = require('widgets/modals/flash');
const { setToken, getTokenNetwork } = require('lib/token');
const Hammer = require('hammerjs');

module.exports = function(el) {
  const ractive = new Ractive({
    el,
    template: require('./index.ract'),
    data: {
      isSettingsShown: false,
    },
  });

  // widgets
  const header = initHeader(ractive.find('#header'));
  header.on('show-settings', () => {
    ractive.set('isSettingsShown', true);
    window.scrollTo(0, 0);
  });

  const settings = initSettings(ractive.find('#settings'));
  settings.on('back', () => {
    ractive.set('isSettingsShown', false);
  });

  initTabs(ractive.find('#tabs'));

  // tabs
  const tabs = {
    send: initSend(ractive.find('#send')),
    receive: initReceive(ractive.find('#receive')),
    exchange: initExchange(ractive.find('#exchange')),
    history: initHistory(ractive.find('#history')),
    tokens: initTokens(ractive.find('#tokens')),
  };

  let currentPage = tabs.send;
  showPage(tabs.send);

  if (process.env.BUILD_TYPE === 'phonegap') {
    Hammer(ractive.find('#main'), { velocity: 0.1 }).on('swipeleft', () => {
      if (currentPage === tabs.send) {
        emitter.emit('change-tab', 'receive');
      } else if (currentPage === tabs.receive) {
        emitter.emit('change-tab', 'exchange');
      } else if (currentPage === tabs.exchange) {
        emitter.emit('change-tab', 'history');
      } else if (currentPage === tabs.history) {
        emitter.emit('change-tab', 'tokens');
      }
    });

    Hammer(ractive.find('#main'), { velocity: 0.1 }).on('swiperight', () => {
      if (currentPage === tabs.tokens) {
        emitter.emit('change-tab', 'history');
      } else if (currentPage === tabs.history) {
        emitter.emit('change-tab', 'exchange');
      } else if (currentPage === tabs.exchange) {
        emitter.emit('change-tab', 'receive');
      } else if (currentPage === tabs.receive) {
        emitter.emit('change-tab', 'send');
      }
    });
  }

  emitter.on('change-tab', (tab) => {
    const page = tabs[tab];
    showPage(page);
  });

  function showPage(page) {
    currentPage.hide();
    page.show();
    currentPage = page;
  }

  emitter.on('wallet-ready', ({ err }) => {
    if (err) {
      if (err.message === 'cs-node-error') {
        emitter.emit('change-tab', 'tokens');
        document.getElementsByTagName('html')[0].classList.add('blocked');
        showError({
          message: "Can't connect to :network node. Please try again later or choose another token.",
          interpolations: { network: getTokenNetwork() },
        });
      } else {
        console.error(err);
        setToken(getTokenNetwork()); // fix wrong tokens
        showError({ message: err.message });
      }
    } else {
      document.getElementsByTagName('html')[0].classList.remove('blocked');
    }
  });

  return ractive;
};
