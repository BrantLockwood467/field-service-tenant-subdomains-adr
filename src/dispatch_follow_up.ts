export type DispatchStatus = 'scheduled' | 'en_route' | 'completed';

export type DispatchDecisionInput = {
  status: DispatchStatus;
  followUpNote: string;
  technicianId: string;
  workOrderId: string;
};

export type DispatchDecision = {
  status: DispatchStatus;
  followUpRequired: boolean;
  summary: string;
};

export function decideDispatchFollowUp(input: DispatchDecisionInput): DispatchDecision {
  const cleanedNote = input.followUpNote.trim();
  const followUpRequired = input.status === 'completed' && cleanedNote.length === 0;

  const summary = followUpRequired
    ? `Work order ${input.workOrderId} was completed by ${input.technicianId}; follow-up still needs to be scheduled.`
    : `Work order ${input.workOrderId} is ${input.status} for technician ${input.technicianId}.`;

  return {
    status: input.status,
    followUpRequired,
    summary
  };
}
