import type { NdaFormData } from "@/types/nda";

const emptyParty = {
  printName: "",
  title: "",
  company: "",
  noticeAddress: "",
  date: "",
};

export const defaultNdaFormData: NdaFormData = {
  purpose: "Evaluating whether to enter into a business relationship with the other party.",
  effectiveDate: "",
  mndaTermType: "expires",
  mndaTermYears: 1,
  confidentialityTermType: "years",
  confidentialityTermYears: 1,
  governingLaw: "",
  jurisdiction: "",
  modifications: "",
  partyOne: { ...emptyParty },
  partyTwo: { ...emptyParty },
};
