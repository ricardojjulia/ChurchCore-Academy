/**
 * ENROLLMENT_AGREEMENT_TEXT_V1
 *
 * Fixed, static enrollment agreement text.
 * Not stored in the database, not per-program, not admin-editable.
 * One template for all institutions in v1.
 *
 * Hash of this text is stored with each signature for auditability.
 */
export const ENROLLMENT_AGREEMENT_TEXT_V1 = `
ENROLLMENT AGREEMENT

By signing this agreement, I affirm that:

1. I have been accepted for admission to the program to which I applied.

2. I understand that enrollment in this program requires my commitment to the institution's academic standards, code of conduct, and faith-based mission.

3. I agree to comply with all policies, procedures, and requirements set forth by the institution during my enrollment.

4. I understand that failure to meet academic or behavioral expectations may result in disciplinary action, including dismissal from the program.

5. I acknowledge that this enrollment agreement is binding and represents my commitment to pursue the program of study for which I have been accepted.

6. I understand that tuition, fees, and other charges will apply according to the institution's published fee schedule, and I am responsible for fulfilling all financial obligations.

7. I affirm that all information provided in my application is accurate and complete to the best of my knowledge.

By clicking "I agree and sign" below, I electronically sign this agreement and acknowledge that my electronic signature has the same legal effect as a handwritten signature.
`.trim();
