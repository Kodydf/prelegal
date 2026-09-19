"""What each supported document needs from the user.

The template files hold only the legal text; the values live on a cover page that the app
generates from these definitions. Fields come from the defined terms each template references
(`coverpage_link`, `keyterms_link`, `orderform_link`, `businessterms_link`).
"""

from typing import Literal

from pydantic import BaseModel


class FieldDef(BaseModel):
    key: str
    label: str
    hint: str = ""
    kind: Literal["text", "long"] = "text"  # "long" allows longer, multi-sentence values
    default: str = ""


class PartyDef(BaseModel):
    key: str
    role: str
    hint: str = ""


class DefinitionSpec(BaseModel):
    id: str
    file: str  # terms template in templates/ (must match catalog.json's file_name)
    name: str
    description: str = ""  # overrides the catalog description when it is not suitable
    note: str = ""  # shown on the cover page and given to the assistant
    parties: list[PartyDef]
    fields: list[FieldDef]


def F(key: str, label: str, hint: str = "", *, long: bool = False, default: str = "") -> FieldDef:
    return FieldDef(key=key, label=label, hint=hint, kind="long" if long else "text", default=default)


def party(key: str, role: str, hint: str = "") -> PartyDef:
    return PartyDef(key=key, role=role, hint=hint)


# --- Shared fields -------------------------------------------------------------------------

EFFECTIVE_DATE = F("effective_date", "Effective Date", "When the agreement starts, e.g. today's date")
GOVERNING_LAW = F("governing_law", "Governing Law", "The state (or country) whose law governs, e.g. Delaware")
CHOSEN_COURTS = F(
    "chosen_courts", "Chosen Courts", 'Where disputes are heard, e.g. "courts located in New Castle, Delaware"'
)
GENERAL_CAP = F(
    "general_cap_amount",
    "General Cap Amount",
    "Each party's maximum total liability for most claims, e.g. the fees paid in the prior 12 months",
)
INCREASED_CLAIMS = F(
    "increased_claims",
    "Increased Claims",
    "Claims that get a higher liability cap, e.g. data breach. Optional: leave blank if none",
)
INCREASED_CAP = F("increased_cap_amount", "Increased Cap Amount", "The higher cap for Increased Claims. Optional")
UNLIMITED_CLAIMS = F(
    "unlimited_claims", "Unlimited Claims", "Claims with no liability cap at all. Optional: leave blank if none"
)
ADDITIONAL_WARRANTIES = F(
    "additional_warranties", "Additional Warranties", "Extra promises either party makes. Optional", long=True
)
DPA = F("dpa", "DPA", "Data processing agreement that applies, if any, e.g. the Common Paper DPA. Optional")


def covered_claims(a: str, b: str) -> list[FieldDef]:
    """Indemnified third-party claims for each of two parties (keys like `provider_covered_claims`)."""
    return [
        F(
            f"{a}_covered_claims",
            f"{a.title()} Covered Claims",
            f"Third-party claims {a.title()} will defend and pay for, e.g. that its product infringes IP",
            long=True,
        ),
        F(
            f"{b}_covered_claims",
            f"{b.title()} Covered Claims",
            f"Third-party claims {b.title()} will defend and pay for, e.g. misuse of content it supplied",
            long=True,
        ),
    ]


def liability_caps(*, increased: bool) -> list[FieldDef]:
    if increased:
        return [GENERAL_CAP, INCREASED_CLAIMS, INCREASED_CAP, UNLIMITED_CLAIMS]
    return [GENERAL_CAP]


PROVIDER = party("provider", "Provider", "The company providing the product or service")
CUSTOMER = party("customer", "Customer", "The company buying it")

# --- Documents -----------------------------------------------------------------------------

DEFINITIONS: list[DefinitionSpec] = [
    DefinitionSpec(
        id="mutual-nda",
        file="Mutual-NDA.md",
        name="Mutual Non-Disclosure Agreement",
        description=(
            "Common Paper's standard mutual non-disclosure agreement, allowing two parties to exchange "
            "confidential information for a stated purpose."
        ),
        parties=[party("party1", "Party 1"), party("party2", "Party 2")],
        fields=[
            F(
                "purpose",
                "Purpose",
                "How Confidential Information may be used",
                long=True,
                default="Evaluating whether to enter into a business relationship with the other party.",
            ),
            EFFECTIVE_DATE,
            F(
                "mnda_term",
                "MNDA Term",
                'How long the MNDA lasts: "Expires N year(s) from Effective Date" or "Continues until terminated"',
                default="Expires 1 year from Effective Date.",
            ),
            F(
                "term_of_confidentiality",
                "Term of Confidentiality",
                'How long Confidential Information stays protected: "N year(s) from Effective Date" or "In perpetuity"',
                default=(
                    "1 year from Effective Date, but in the case of trade secrets until Confidential "
                    "Information is no longer considered a trade secret under applicable laws."
                ),
            ),
            GOVERNING_LAW,
            F("jurisdiction", "Jurisdiction", 'City or county and state, e.g. "courts located in New Castle, DE"'),
            F("modifications", "MNDA Modifications", "Any changes to the standard terms. Optional", long=True),
        ],
    ),
    DefinitionSpec(
        id="cloud-service-agreement",
        file="CSA.md",
        name="Cloud Service Agreement",
        parties=[PROVIDER, CUSTOMER],
        fields=[
            EFFECTIVE_DATE,
            F("order_date", "Order Date", "When the first order starts"),
            F("subscription_period", "Subscription Period", "How long the subscription runs, e.g. 12 months"),
            F(
                "non_renewal_notice_date",
                "Non-Renewal Notice Date",
                "Deadline to give notice not to renew, e.g. 30 days before the end of the Subscription Period",
            ),
            F(
                "technical_support",
                "Technical Support",
                "Support the Provider offers, e.g. email support on business days",
                long=True,
            ),
            *liability_caps(increased=False),
            *covered_claims("provider", "customer"),
            DPA,
            GOVERNING_LAW,
            CHOSEN_COURTS,
        ],
    ),
    DefinitionSpec(
        id="design-partner-agreement",
        file="design-partner-agreement.md",
        name="Design Partner Agreement",
        parties=[
            party("provider", "Provider", "The company giving early access to its product"),
            party("partner", "Partner", "The early customer or partner"),
        ],
        fields=[
            EFFECTIVE_DATE,
            F("term", "Term", "How long the Partner has early access, e.g. 6 months"),
            F(
                "program",
                "Program",
                "What the design partner program involves: access, feedback expectations, meetings",
                long=True,
            ),
            F("fees", "Fees", "What the Partner pays, if anything. Write 'None' if free"),
            GOVERNING_LAW,
            CHOSEN_COURTS,
        ],
    ),
    DefinitionSpec(
        id="service-level-agreement",
        file="sla.md",
        name="Service Level Agreement",
        note="Designed to be used alongside a Cloud Service Agreement.",
        parties=[PROVIDER, CUSTOMER],
        fields=[
            F(
                "subscription_period",
                "Subscription Period",
                "The subscription this SLA covers, e.g. 12 months from the Order Date",
            ),
            F("target_uptime", "Target Uptime", "Availability the Provider aims for each month, e.g. 99.9%"),
            F(
                "target_response_time",
                "Target Response Time",
                "How fast Provider responds to support requests, e.g. 4 business hours",
            ),
            F("support_channel", "Support Channel", "Where support requests are sent, e.g. support@provider.com"),
            F(
                "uptime_credit",
                "Uptime Credit",
                "Credit if uptime falls short, e.g. 10% of monthly fees for each 1% below target",
                long=True,
            ),
            F(
                "response_time_credit",
                "Response Time Credit",
                "Credit if response times are missed, e.g. 5% of monthly fees",
                long=True,
            ),
            F(
                "scheduled_downtime",
                "Scheduled Downtime",
                "Planned maintenance that doesn't count against uptime, e.g. Sundays 1-3am UTC",
                long=True,
            ),
        ],
    ),
    DefinitionSpec(
        id="professional-services-agreement",
        file="psa.md",
        name="Professional Services Agreement",
        note=(
            "Project details such as deliverables, fees, and timelines are set out in each "
            "Statement of Work (SOW), not on this cover page."
        ),
        parties=[PROVIDER, CUSTOMER],
        fields=[
            EFFECTIVE_DATE,
            F(
                "customer_policies",
                "Customer Policies",
                "Customer policies the Provider must follow, if any. Optional",
                long=True,
            ),
            F(
                "security_policy",
                "Security Policy",
                "Security standards the Provider must follow, if any. Optional",
                long=True,
            ),
            ADDITIONAL_WARRANTIES,
            *liability_caps(increased=True),
            *covered_claims("provider", "customer"),
            F(
                "insurance_minimums",
                "Insurance Minimums",
                "Minimum insurance each party must carry, if any. Optional",
                long=True,
            ),
            DPA,
            GOVERNING_LAW,
            CHOSEN_COURTS,
        ],
    ),
    DefinitionSpec(
        id="data-processing-agreement",
        file="DPA.md",
        name="Data Processing Agreement",
        parties=[PROVIDER, CUSTOMER],
        fields=[
            F(
                "agreement",
                "Agreement",
                "The main agreement this DPA is part of, e.g. the Cloud Service Agreement dated ...",
            ),
            F(
                "nature_and_purpose",
                "Nature and Purpose of Processing",
                "What the Provider does with personal data and why",
                long=True,
            ),
            F(
                "categories_of_personal_data",
                "Categories of Personal Data",
                "Types of personal data, e.g. names, emails, usage data",
                long=True,
            ),
            F(
                "categories_of_data_subjects",
                "Categories of Data Subjects",
                "Whose data it is, e.g. Customer's employees and end users",
                long=True,
            ),
            F("special_category_data", "Special Category Data", "Any sensitive data (health, biometric, etc.) or 'None'"),
            F(
                "special_category_restrictions",
                "Special Category Data Restrictions or Safeguards",
                "Extra protections for special category data. Optional if none",
                long=True,
            ),
            F("frequency_of_transfer", "Frequency of Transfer", "How often data moves, e.g. continuously"),
            F(
                "duration_of_processing",
                "Duration of Processing",
                "How long data is processed, e.g. for the term of the Agreement",
            ),
            F(
                "approved_subprocessors",
                "Approved Subprocessors",
                "Subprocessors, with country and task, e.g. AWS (US) hosting",
                long=True,
            ),
            F("security_policy", "Security Policy", "The security standards Provider is audited against, e.g. SOC 2 Type II"),
            F(
                "provider_security_contact",
                "Provider Security Contact",
                "Who to contact about security questions, e.g. security@provider.com",
            ),
            F(
                "governing_member_state",
                "Governing Member State",
                "EU member state whose law governs the EEA transfer clauses, e.g. Ireland",
            ),
        ],
    ),
    DefinitionSpec(
        id="software-license-agreement",
        file="Software-License-Agreement.md",
        name="Software License Agreement",
        parties=[PROVIDER, CUSTOMER],
        fields=[
            EFFECTIVE_DATE,
            F("order_date", "Order Date", "When the first order starts"),
            F("subscription_period", "Subscription Period", "How long the license lasts, e.g. 12 months"),
            F(
                "non_renewal_notice_date",
                "Non-Renewal Notice Date",
                "Deadline to give notice not to renew, e.g. 30 days before the end of the Subscription Period",
            ),
            F(
                "permitted_uses",
                "Permitted Uses",
                "What Customer may use the software for, e.g. internal business purposes",
                long=True,
            ),
            F("license_limits", "License Limits", "Caps on use, e.g. number of users, devices, or sites", long=True),
            F(
                "payment_process",
                "Payment Process",
                "How and when fees are paid, e.g. annual invoice, net 30",
                long=True,
            ),
            F(
                "warranty_period",
                "Warranty Period",
                "How long the software is warranted to match its documentation, e.g. 90 days",
            ),
            F(
                "deletion_procedure",
                "Deletion Procedure",
                "How Customer removes the software at the end, e.g. uninstall and certify in writing",
                long=True,
            ),
            ADDITIONAL_WARRANTIES,
            *liability_caps(increased=True),
            *covered_claims("provider", "customer"),
            GOVERNING_LAW,
            CHOSEN_COURTS,
        ],
    ),
    DefinitionSpec(
        id="partnership-agreement",
        file="Partnership-Agreement.md",
        name="Partnership Agreement",
        parties=[
            party("company", "Company", "One partner (the trademark licensor for co-marketing)"),
            party("partner", "Partner", "The other partner"),
        ],
        fields=[
            EFFECTIVE_DATE,
            F("end_date", "End Date", "When the partnership ends"),
            F(
                "obligations",
                "Obligations",
                "What each party will do, e.g. co-marketing, referrals, integrations",
                long=True,
            ),
            F("territory", "Territory", "Where the trademark license applies, e.g. worldwide"),
            F("brand_guidelines", "Brand Guidelines", "Brand usage rules or a link to them. Optional", long=True),
            F("payment_schedule", "Payment Schedule", "When fees are due, if any, e.g. quarterly. Optional"),
            F("payment_process", "Payment Process", "How fees are billed and paid, if any. Optional", long=True),
            ADDITIONAL_WARRANTIES,
            *liability_caps(increased=True),
            *covered_claims("company", "partner"),
            DPA,
            GOVERNING_LAW,
            CHOSEN_COURTS,
        ],
    ),
    DefinitionSpec(
        id="business-associate-agreement",
        file="BAA.md",
        name="Business Associate Agreement",
        note=(
            "A HIPAA agreement: the Provider is the Business Associate handling protected health "
            "information for the Company (the Covered Entity)."
        ),
        parties=[
            party("provider", "Provider", "The business associate that handles the health data"),
            party("company", "Company", "The covered entity that owns the health data"),
        ],
        fields=[
            F("baa_effective_date", "BAA Effective Date", "When the BAA starts"),
            F(
                "agreement",
                "Agreement",
                "The services agreement this BAA supports, e.g. the Cloud Service Agreement dated ...",
            ),
            F(
                "breach_notification_period",
                "Breach Notification Period",
                "How quickly Provider must report a breach, e.g. within 5 business days",
            ),
            F(
                "limitations",
                "Limitations",
                "Limits on how Provider may use or disclose PHI or use subcontractors. Optional",
                long=True,
            ),
        ],
    ),
    DefinitionSpec(
        id="pilot-agreement",
        file="Pilot-Agreement.md",
        name="Pilot Agreement",
        parties=[PROVIDER, CUSTOMER],
        fields=[
            EFFECTIVE_DATE,
            F("pilot_period", "Pilot Period", "How long the trial lasts, e.g. 60 days"),
            GENERAL_CAP,
            GOVERNING_LAW,
            CHOSEN_COURTS,
        ],
    ),
    DefinitionSpec(
        id="ai-addendum",
        file="AI-Addendum.md",
        name="AI Addendum",
        note="An addendum to a main agreement (such as a Cloud Service Agreement) covering AI features.",
        parties=[PROVIDER, CUSTOMER],
        fields=[
            F("agreement", "Agreement", "The main agreement this addendum supplements"),
            F(
                "training_data",
                "Training Data",
                "Customer data the Provider may use to train models. Leave blank for none",
                long=True,
            ),
            F(
                "training_purposes",
                "Training Purposes",
                "What the Provider may train models for. Leave blank for none",
                long=True,
            ),
            F(
                "training_restrictions",
                "Training Restrictions",
                "Limits on training, e.g. must be de-identified. Optional",
                long=True,
            ),
            F(
                "improvement_restrictions",
                "Improvement Restrictions",
                "Limits on using data to improve the product without training. Optional",
                long=True,
            ),
        ],
    ),
]
