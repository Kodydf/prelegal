export type MndaTermType = "expires" | "continues";
export type ConfidentialityTermType = "years" | "perpetuity";

export interface PartyDetails {
  printName: string;
  title: string;
  company: string;
  noticeAddress: string;
  date: string;
}

export interface NdaFormData {
  purpose: string;
  effectiveDate: string;
  mndaTermType: MndaTermType;
  mndaTermYears: number;
  confidentialityTermType: ConfidentialityTermType;
  confidentialityTermYears: number;
  governingLaw: string;
  jurisdiction: string;
  modifications: string;
  partyOne: PartyDetails;
  partyTwo: PartyDetails;
}
