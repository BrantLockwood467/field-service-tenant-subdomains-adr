import test from 'node:test';
import assert from 'node:assert/strict';
import { decideDispatchFollowUp } from './dispatch_follow_up';

test('completed work order without a follow-up note requires technician follow-up', () => {
  const result = decideDispatchFollowUp({
    status: 'completed',
    followUpNote: '   ',
    technicianId: 'tech_77',
    workOrderId: 'wo_2048'
  });

  assert.equal(result.followUpRequired, true);
  assert.equal(
    result.summary,
    'Work order wo_2048 was completed by tech_77; follow-up still needs to be scheduled.'
  );
});
