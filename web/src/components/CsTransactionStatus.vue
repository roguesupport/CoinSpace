<script>
import CsButton from './CsButton.vue';
import MainLayout from '../layouts/MainLayout.vue';

import FailCrossIcon from '../assets/svg/failCross.svg';
import SuccessTickIcon from '../assets/svg/successTick.svg';

export default {
  components: {
    MainLayout,
    CsButton,
    FailCrossIcon,
    SuccessTickIcon,
  },
  props: {
    transaction: {
      type: Object,
      default() {
        return {};
      },
    },
    status: {
      type: Boolean,
      default: true,
    },
    title: {
      type: String,
      default: undefined,
    },
    header: {
      type: String,
      default: undefined,
    },
    message: {
      type: String,
      default: undefined,
    },
    action: {
      type: String,
      default: undefined,
    },
    onDone: {
      type: Function,
      default: undefined,
    },
  },
  computed: {
    crypto() {
      return this.transaction?.crypto || this.$wallet?.crypto;
    },
    internalTitle() {
      return this.title || this.$t('Confirm transaction');
    },
    internalHeader() {
      if (this.header) {
        return this.header;
      }
      if (this.status) {
        return this.$t('Transaction successful');
      } else {
        return this.$t('Transaction failed');
      }
    },
    internalMessage() {
      if (this.message) {
        return this.message;
      }
      if (this.status) {
        return this.$t('Your transaction will appear in your history tab shortly.');
      } else {
        return this.$t('{name} node error. Please try again later.', {
          name: this.crypto.name,
        });
      }
    },
    internalAction() {
      if (this.action) {
        return this.action;
      }
      if (this.status) {
        return this.$t('Done');
      } else {
        return this.$t('Try again');
      }
    },
  },
  methods: {
    done() {
      if (this.onDone) {
        this.onDone();
      } else {
        this.$router.up();
      }
    },
  },
};
</script>

<template>
  <MainLayout
    :title="internalTitle"
    @back="onDone"
  >
    <div
      class="&__icon"
      :class="{ '&__icon--success': status, '&__icon--failed': !status, }"
    >
      <SuccessTickIcon v-if="status" />
      <FailCrossIcon v-if="!status" />
    </div>
    <div class="&__info">
      <div class="&__info-header">
        {{ internalHeader }}
      </div>
      <div class="&__info-message">
        {{ internalMessage }}
      </div>
    </div>
    <CsButton
      :type="status ? 'primary' : 'danger-light'"
      @click="done"
    >
      {{ internalAction }}
    </CsButton>
  </MainLayout>
</template>

<style lang="scss">
  .#{ $filename } {
    $self: &;

    &__icon {
      width: $spacing-8xl;
      height: $spacing-8xl;
      align-self: center;
      border-radius: 50%;
      animation: status-icon 0.2s ease-in 0.1s forwards;
      opacity: 0;
      transform: scale(0.3);

      path {
        stroke-dasharray: 100;
        stroke-dashoffset: 100;
      }

      &--success {
        background-color: $primary-light;

        path {
          animation: status-success-path 0.3s ease-in 0.15s forwards;
        }
      }

      &--failed {
        background-color: $danger-light;

        path {
          animation: status-failed-path 0.3s ease-in 0.15s forwards;
        }
      }
    }

    &__info {
      display: flex;
      flex-direction: column;
      flex-grow: 1;
      gap: $spacing-md;
    }

    &__info-header {
      @include text-lg;
      @include text-bold;
    }

    &__info-message {
      @include text-md;
    }
  }
</style>
