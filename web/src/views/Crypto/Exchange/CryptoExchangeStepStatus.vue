<script>
import CsStep from '../../../components/CsStep.vue';
import CsTransactionStatus from '../../../components/CsTransactionStatus.vue';

export default {
  components: {
    CsTransactionStatus,
  },
  extends: CsStep,
};
</script>

<template>
  <CsTransactionStatus
    :title="$t('Confirm swap')"
    :status="storage.status"
    :message="storage.message"
  />
</template>
