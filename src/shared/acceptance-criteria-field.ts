export interface AcceptanceCriteriaFieldDescriptor {
  id: string;
  custom: boolean;
  schemaType: string | null;
}

export function isSupportedAcceptanceCriteriaField(
  field: AcceptanceCriteriaFieldDescriptor,
): boolean {
  return (
    field.id === "description" ||
    (field.custom === true && field.schemaType === "string")
  );
}

export function hasSupportedAcceptanceCriteriaField(
  fields: readonly AcceptanceCriteriaFieldDescriptor[],
  fieldId: string,
): boolean {
  return fields.some(
    (field) =>
      field.id === fieldId && isSupportedAcceptanceCriteriaField(field),
  );
}
