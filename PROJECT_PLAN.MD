ZERONIX INTELLIGENCE

Procurement Intelligence, Enquiry Intelligence, Multi-Agent Workspace & Organizational Second Brain

Document Type: System Design Requirements (SDR)
Version: 1.0 Planning Baseline
Date: 20 September 2026
Status: Architecture and Product Planning
Primary Objective: Build the operational intelligence system behind Zeronix Technology LLC.

1. Executive Summary

Zeronix Intelligence will be an internal operating platform that converts fragmented business information into structured, searchable, reusable organizational intelligence.

It is not intended to be another traditional CRM.

The system will initially solve four fundamental problems:

Supplier and vendor knowledge is scattered across WhatsApp, Excel sheets, emails, individual employees and memory.

Customer enquiries arrive through multiple channels and are not consistently converted into structured procurement requirements.

Product availability and supplier pricing change constantly, making normal inventory systems poorly suited to Zeronix's no-stock/reseller operating model.

AI assistants normally lose organizational context when sessions end or when the company changes LLM providers.

Zeronix Intelligence will therefore combine:

Supplier Intelligence

Product Intelligence

Supplier Broadcast Intelligence

Stock and Price Observations

Enquiry Intelligence

Sourcing

RFQ Management

Procurement Decisions

Quotations

Follow-ups

Business Knowledge

Multiple Specialized AI Agents

Persistent Organizational Memory

Search and Retrieval

Audit and Evidence Tracking

The long-term objective is for the platform to become the operational second brain of Zeronix.

The system should eventually be able to answer questions such as:

We need 200 Dell laptops with this specification. What exact model matches the requirement, which suppliers recently advertised it, what prices have we observed, how fresh are those prices, who normally supplies this category, who gives us credit, have we purchased or quoted this product before, which enquiries are related, and what should we do next?

Every answer must be traceable to actual business evidence.

2. Product Philosophy

The system will follow several principles inherited from the existing Zeronix Engine working method.

2.1 Evidence Before Intelligence

The application must collect and preserve source information before trying to make intelligent conclusions.

Examples:

Supplier broadcast → preserve original message.

Email enquiry → preserve original email.

Supplier quotation → preserve original quote.

Excel stock list → preserve original file/import row.

User correction → preserve original interpretation and corrected value.

AI must work on top of evidence.

AI must never replace evidence.

2.2 Immutable Business History

Historical information should rarely be overwritten.

If Supplier A quoted:

AED 2,450 today

and:

AED 2,390 three weeks ago

both observations remain stored.

Similarly:

Quotation Revision 1 must remain after Revision 2.

Product matching corrections must retain previous match history.

Supplier selection decisions must preserve the evidence that existed at the time.

This allows Zeronix to understand:

price history

supplier behavior

quotation history

procurement decisions

employee actions

AI decisions

correction history

3. Unknown Is a Valid Value

The system must never manufacture information simply to complete a form.

Examples:

Warranty: Unknown

Stock: Unknown

Delivery: Not provided

Part number: Not identified

Supplier location: Unknown

Customer deadline: Not provided

This rule applies especially to AI-generated output.

4. Human Authority

AI assists.

Humans decide.

The system may:

identify possible products

parse enquiries

parse supplier broadcasts

recommend supplier candidates

summarize price history

draft supplier RFQs

draft customer messages

retrieve business knowledge

identify incomplete information

The system must not autonomously create business truth.

Important procurement and commercial decisions remain under user control.

5. Product Scope

Zeronix Intelligence will consist of the following major domains.

Core Intelligence

Suppliers

Supplier Contacts

Brands

Categories

Products

Product Aliases

Supplier Broadcasts

Supplier Stock

Price Observations

Stock Observations

Evidence Sources

Procurement Knowledge

Enquiry Intelligence

Email Enquiries

Manual Enquiries

Contact Form Enquiries

WhatsApp Enquiries

Imported Enquiries

Requirement Parsing

Product Identification

Enquiry Timeline

Enquiry Ownership

Procurement

Sourcing

Supplier Discovery

Existing Stock Search

Existing Price Search

RFQs

Supplier Responses

Procurement Comparison

Procurement Decisions

Commercial

Customer Quotations

Quotation Revisions

Pricing

Margin

Follow-ups

Customer Communication

Intelligence Platform

Agents

Agent Skills

Agent Tools

Agent Conversations

Agent Memory

Business Knowledge

Search

Learning Registry

LLM Providers

Administration

Users

Roles

Permissions

Settings

AI Provider Configuration

Audit Logs

Integrations

Dictionaries

System Rules

6. What Zeronix Intelligence Is Not

The initial application should not become:

a marketplace

a full ERP

full accounting software

warehouse management software

autonomous purchasing software

an autonomous sales agent

a mass-email marketing system

a customer support ticket system

a generic CRM

a microservice architecture

a complicated machine-learning platform

The goal is operational intelligence.

7. Core Business Flow

The long-term operational flow is:

Customer Requirement

↓

Enquiry Capture

↓

Requirement Extraction

↓

Product Identification

↓

Existing Procurement Intelligence Search

↓

Supplier / Stock / Price Discovery

↓

Fresh RFQ when required

↓

Supplier Response

↓

Procurement Comparison

↓

Supplier Selection

↓

Margin / Selling Price

↓

Customer Quotation

↓

Follow-Up

↓

Order

↓

Reusable Business Knowledge

Every step should contribute information back into the system.

8. Supplier Intelligence

Supplier Intelligence will be one of the first fully completed modules.

A supplier is not simply a CRM company record.

A supplier represents procurement capability.

Supplier fields

Store:

Legal company name

Trading name

Supplier code

Supplier type

Country

Emirate

Area

Address

Website

General phone

WhatsApp

General email

TRN

Status

Internal account owner

Notes

Supplier types may include:

Authorized Distributor

Distributor

Stockist

Reseller

Trader

Importer

Marketplace Seller

Service Provider

Project Partner

9. Supplier Procurement Profile

Each supplier should have procurement characteristics.

Examples:

Brands handled

Categories handled

Product specialties

UAE stock

Imported stock

Warranty type

Payment terms

Credit availability

Credit limit

Credit period

Delivery areas

Typical lead time

Minimum order requirements

Relationship notes

Preferred communication channel

Do not create one generic supplier score initially.

The system should show evidence and procurement characteristics separately.

10. Supplier Contacts

One supplier may contain multiple useful contacts.

Example:

ABC Computers

Ahmed — Dell laptops

Rashid — Servers

Mohammed — Networking

Finance Team — Payments

Store:

Name

Job title

Department

Phone

WhatsApp

Email

Brands handled

Categories handled

Preferred channel

Notes

Active/inactive

Last interaction

This allows the system eventually to answer:

Who should I contact for HPE server pricing?

11. Supplier Broadcast Intelligence

Supplier broadcasts are one of the highest-value information sources in the system.

Example raw broadcast:

Dell 5440
i7 16/512
DOS
25pc ready
2450+
UAE

The original message must always be preserved.

The application creates structured observations from the message.

12. Broadcast Data Model

Each broadcast should store:

Source supplier

Source contact

Channel

Received date/time

Raw text

Original formatting where possible

Attachments

Processing status

Extraction status

Review status

Parsed items

Extraction confidence

Created by

Corrected by

Correction history

Possible channels:

Manual paste

WhatsApp

Email

Excel import

PDF

Supplier portal

API

Other

13. Broadcast Extraction

Example:

Raw:

Dell 5440 i7-1355U 16/512 FHD DOS 25pcs 2450+ UAE

Structured observation:

Brand
Dell

Family
Latitude

Model
5440

CPU
Intel Core i7-1355U

RAM
16GB

Storage
512GB SSD

Display
FHD

Operating System
DOS

Quantity
25

Price
AED 2,450

VAT
Excluded

Market
UAE

Source
Supplier Broadcast

Observed At
Timestamp

The raw message remains attached to this structured record.

14. Broadcast Review Queue

AI extraction must not silently become product truth.

Extraction statuses:

Exact

High Confidence

Needs Review

Unmatched

Ignored

Users should be able to:

confirm extraction

edit extraction

link existing product

create temporary product

merge with another product

mark irrelevant

correct supplier

correct price

correct quantity

Every correction becomes learning evidence.

15. Product Intelligence

Products must have canonical identities.

Example:

Canonical product:

Lenovo V15 G4 IRU
Part Number: 83A100SUAK

Supplier aliases might include:

V15 G4

V15 IRU

V15G4

V15 13TH

83A100SUAK

LEN V15 I5

All should eventually connect to the same canonical product where appropriate.

16. Product Master

Product data should include:

Brand

Category

Product family

Model

Part number

Manufacturer SKU

Manufacturer

Region

Lifecycle

Warranty

Description

Aliases

Specifications

Specifications must be category-aware.

Example laptop attributes:

CPU

RAM

storage

GPU

screen

OS

Server attributes may include:

CPU count

core count

RAM configuration

drive bays

controller

NIC

PSU

RAID

warranty

Networking equipment will require completely different attributes.

Do not create one giant fixed specification table.

17. Product Matching Engine

Product matching should use several layers.

Layer 1

Exact manufacturer part number.

Layer 2

Exact normalized model.

Layer 3

Known alias.

Layer 4

Brand + family + specifications.

Layer 5

Fuzzy matching.

Layer 6

LLM-supported interpretation.

AI should therefore be near the end of the matching process rather than the beginning.

Possible results:

Exact Match

Probable Match

Possible Match

Unmatched

Human review remains available.

18. Price Observations

A product does not have one permanent price.

Instead:

Product + Supplier + Price + Date + Evidence

creates a price observation.

Example:

Supplier

Price

Stock

Observed

Supplier A

AED 2,450

25

3 hours ago

Supplier B

AED 2,475

Unknown

Yesterday

Supplier C

AED 2,390

5

18 days ago

The application should emphasize freshness.

Old observations remain available historically.

19. Stock Observations

Stock should follow the same time-aware model.

Store:

Supplier

Product

Quantity

Stock status

Date/time

Source

Evidence reference

Stock states:

In Stock

Limited

Available

Incoming

On Request

Out of Stock

Unknown

20. Evidence Drawer

Any important procurement value should be explainable.

Clicking:

AED 2,450

should allow the user to see:

Supplier

Contact

Original broadcast

Original date

Extraction

User corrections

Product mapping

Associated file/message

This creates trust in the system.

21. Enquiry Intelligence

The enquiry module must deliberately avoid looking like a traditional CRM pipeline.

The main question is not:

Which sales stage is this lead in?

The main questions are:

What exactly does this customer need?

What information do we already know?

What still needs clarification?

What product matches?

Where can we source it?

What is blocking the response?

22. Enquiry Sources

Eventually support:

Email

Website forms

WhatsApp API

Manual entry

Phone-call entry

Imported spreadsheets

API

Future connectors

Initial development should focus on:

Email + Manual Entry

These two sources are sufficient to create a real working workflow.

23. Enquiry Record

Store:

Enquiry ID

Customer

Contact

Original source

Original message

Subject

Received time

Assigned user

Priority

Required date

Customer deadline

Items

Notes

Current status

Last activity

Next action

Suggested operational states:

NEW

ASSIGNED

SOURCING

WAITING_SUPPLIER

QUOTATION_READY

QUOTED

NEGOTIATION

FOLLOW_UP

WON

LOST

ON_HOLD

These are operational states rather than a traditional sales funnel.

24. Email Enquiry Ingestion

Do not begin email processing with an LLM.

The ingestion pipeline should be deterministic first.

Recommended architecture:

IMAP mailbox

↓

Message ingestion

↓

MIME parsing

↓

Normalization

↓

Dictionary / rule engine

↓

Candidate scoring

↓

Candidate enquiry

↓

LLM extraction only where useful

↓

Human review / enquiry creation

For the initial TypeScript stack, use ImapFlow for IMAP connectivity and PostalMime for parsing raw email messages.

ImapFlow provides promise-based IMAP access, streaming, mailbox locking and modern extension handling. PostalMime handles MIME/RFC email parsing and includes TypeScript types and parsing safety limits.

The older Nodemailer Mailparser repository has roughly 1.7k GitHub stars, but its own project documentation states that it is in maintenance mode and recommends PostalMime for new projects.

EmailEngine should not be introduced merely because it provides a complete email gateway; its current server licensing is commercial, whereas direct ImapFlow + PostalMime keeps the initial ingestion layer lightweight and open-source.

25. Email Normalization

Store both:

RAW_EMAIL

and:

NORMALIZED_EMAIL

Extract:

Message ID

Thread ID where available

From

To

CC

Subject

Text body

HTML body

Received time

Attachments

Reply headers

Mailbox

Folder

Provider account

HTML must be converted to clean text for classification.

Do not destroy the original MIME/email source.

26. Generic Enquiry Dictionary

A dictionary-based classifier should handle the majority of obvious enquiry detection without calling an LLM.

Dictionary entries should be database-managed rather than permanently hardcoded.

High-value intent terms

Examples:

RFQ

Request for Quote

Request for Quotation

Quote Request

Quotation Required

Price Request

Please Quote

Kindly Quote

Looking to Buy

Requirement

Required

Need

Need Price

Best Price

Availability

Stock Availability

Lead Time

Supply

Tender

BOQ

Purchase Requirement

Procurement Request

Pricing

Price and Availability

27. Product Evidence Dictionary

Look for:

Known brands

Examples:

Dell

HP

Lenovo

HPE

Cisco

Ubiquiti

Fortinet

Aruba

Synology

Samsung

Microsoft

Hikvision

Dahua

ZKTeco

Yealink

and all other brands maintained in the Zeronix brand master.

Look for product categories such as:

Laptop

Desktop

Workstation

Server

SSD

RAM

Switch

Firewall

Access Point

Printer

Monitor

NAS

Storage

CCTV

NVR

DVR

IP Phone

Access Control

Biometric

Display

Video Conference

etc.

28. Specification Pattern Detection

Deterministic patterns should detect possible:

quantities

part numbers

SKUs

CPU names

RAM capacities

storage capacities

screen sizes

GPU names

switch port counts

server models

currency

price values

product model patterns

Example:

16GB

512GB

i7-1355U

U7 155H

83A100SUAK

Qty 200

These signals strongly indicate a procurement enquiry.

29. Negative Email Dictionary

Avoid creating enquiries from obvious:

newsletters

marketing emails

SEO promotions

recruitment

job applications

automated notifications

invoices

payment receipts

spam

social media notifications

Rules should be configurable.

30. Enquiry Candidate Scoring

An example deterministic scoring model:

Subject contains strong RFQ phrase
+30

Body contains procurement intent
+15

Known customer
+15

Known brand
+10

Recognized product category
+10

Recognized product/specification pattern
+10

Quantity detected
+5

RFQ/BOQ attachment filename
+10

Known spam/marketing pattern
-40

Recruitment language
-40

Newsletter indicators
-30

This should remain configurable.

Example:

Score 70+

High-confidence enquiry candidate.

Score 40–69

Triage queue.

Score below 40

Do not create an enquiry automatically.

Thresholds should be configurable after real mailbox observations.

31. LLM Role in Email Processing

Only after deterministic filtering should the application optionally use an LLM.

LLM responsibilities:

remove irrelevant conversation text

summarize customer requirement

identify enquiry items

normalize specifications

identify missing information

suggest category

suggest product matches

detect urgency

detect requested delivery location

separate commercial requirements from technical requirements

The LLM does not decide whether something happened.

The original email remains the evidence.

32. Manual Enquiry Entry

Manual entry must be extremely fast.

Users should be able to paste:

Need 200 Dell Latitude U7 16GB 512GB Windows Pro delivery Dubai urgently.

The system should immediately create an enquiry draft and extract:

Quantity: 200

Brand: Dell

Family: Latitude

CPU: Core Ultra 7

RAM: 16GB

Storage: 512GB

OS: Windows Pro

Delivery: Dubai

Urgency: Urgent

Anything not provided remains Unknown.

33. Multi-Agent Intelligence Layer

Agents will be a core platform feature rather than a hardcoded list.

Users must be able to create multiple agents.

Examples might eventually include:

Procurement Agent

Product Specialist

Server Specialist

Enquiry Analyst

Supplier Research Agent

Quotation Assistant

Sales Follow-Up Agent

Market Research Agent

Technical Solution Architect

Management Intelligence Agent

The application should not assume that this is the final agent list.

34. Agent Definition

Every agent should have a persisted Agent Definition containing:

Agent ID

Name

Description

Business purpose

Role

Domain

System instructions

Skill packages

Allowed tools

Allowed data domains

Restricted data domains

Default LLM provider

Default model

Creativity setting

Token budget

Memory scope

Retrieval settings

Approval requirements

Status

Skill version

35. Core Business Constitution

Agents should not operate from isolated prompts.

Every agent inherits a global:

Zeronix Business Constitution

This contains durable rules shared by all agents.

Examples:

Evidence before intelligence.

Never fabricate business facts.

Preserve source and freshness.

Unknown is valid.

Supplier price is time-sensitive.

Customer information and supplier cost have different visibility.

Important external actions require authorization.

Maintain auditability.

Follow Zeronix product and service domains.

Prefer reusable organizational knowledge over temporary chat context.

Do not overwrite historical commercial evidence.

This prevents individual agents from drifting away from core business behavior.

36. Agent Skills

Agents can possess one or more skills.

Examples:

procurement-product-matching

supplier-research

server-spec-validation

quotation-analysis

rfq-extraction

email-enquiry-classification

technical-solution-design

follow-up-writing

Skills must be versioned.

A skill contains:

Purpose

Inputs

Business rules

Workflow

Tool requirements

Output schema

Validation rules

Failure conditions

Examples

Version

Change history

37. Agent Tool Architecture

Agents must not directly manipulate database tables.

Expose controlled application capabilities as tools.

Examples:

searchSuppliers

getSupplier

searchProducts

getProductObservations

getLatestPrices

getStockEvidence

createEnquiryDraft

parseBroadcast

createPriceObservation

searchKnowledge

createRFQDraft

getCustomerHistory

searchSimilarEnquiries

Every tool should have:

structured input

structured output

schema validation

permission check

audit logging

rate limiting where needed

This architecture can later be exposed through MCP if useful.

The important principle is:

Agents interact with business capabilities, not directly with raw infrastructure.

38. The Zeronix Second Brain

LLM conversation context must never become the company's long-term memory.

The Second Brain will be owned by Zeronix Intelligence itself.

The LLM should effectively be treated as stateless.

Each request follows:

User message

↓

Agent Router

↓

Context Builder

↓

Second Brain Retrieval

↓

Relevant Business Evidence

↓

Relevant Agent Memories

↓

Agent Skill Instructions

↓

Selected LLM

↓

Response

↓

Result / tool actions

↓

Memory Learning Pipeline

↓

PostgreSQL

The next conversation reconstructs context from the database.

Therefore Zeronix can move from Claude to OpenAI to Gemini to a local model without losing institutional knowledge.

39. Second Brain Memory Types

Do not store every piece of information as one generic vector.

Use several memory classes.

A. Source Evidence

Hard business evidence.

Examples:

email

supplier broadcast

quotation

spreadsheet

customer requirement

supplier response

Highest trust.

B. Structured Business Facts

Examples:

Supplier ABC handles Lenovo.

Supplier contact Ahmed handles laptops.

Customer requested 200 units.

Product uses part number XYZ.

Facts should maintain provenance.

C. Episodic Memory

Records what occurred.

Example:

On September 18, the Procurement Agent compared three suppliers for Product X. Supplier B was selected because Supplier A lacked sufficient quantity.

D. Semantic Memory

Reusable business knowledge.

Example:

Supplier X commonly handles Lenovo SMB notebooks.

E. Procedural Memory

Reusable methods.

Example:

When checking HPE DL380 configurations, verify CPU, DIMM layout, drive bays, controller, NIC, PSU and warranty.

This type of memory can eventually become part of an Agent Skill.

F. User / Team Preferences

Non-sensitive operational preferences.

Examples:

Preferred quotation format.

Preferred sourcing workflow.

Preferred supplier communication structure.

40. PostgreSQL as Memory Source of Truth

Use PostgreSQL for:

structured records

conversations

memories

agent definitions

skills

evidence

relationships

audit logs

Use PostgreSQL full-text search for lexical retrieval.

Use pgvector for semantic retrieval where semantic matching improves results.

Do not create a separate vector database initially.

This keeps architecture simple and keeps organizational memory within one controlled data platform.

41. Memory Record

Suggested model:

Memory

id

memory_type

title

content

structured_data

entity_type

entity_id

agent_id

source_type

source_id

confidence

importance

valid_from

valid_until

created_at

last_used_at

retrieval_count

status

embedding

created_by

approved_by

The important feature is provenance.

A memory should be able to answer:

Why does the system believe this?

42. Context Builder

Never send an entire database or entire conversation history to an LLM.

For every request, the Context Builder determines what is actually relevant.

Example:

User asks Procurement Agent:

Who has the latest stock for Lenovo V15?

Context Builder retrieves:

relevant agent instructions

Lenovo V15 product entity

aliases

current supplier observations

recent broadcasts

relevant supplier profiles

prior useful procurement knowledge

It does not retrieve unrelated quotations, customers or broadcasts.

This reduces:

token consumption

latency

privacy exposure

hallucination

context confusion

43. Hybrid Retrieval

Second Brain retrieval should combine:

Exact / deterministic search

Part numbers.

Email addresses.

Supplier names.

Product models.

Customer IDs.

Brand names.

Full-text search

Descriptions.

Broadcast text.

Email content.

Knowledge.

Semantic retrieval

Meaningally similar requirements.

Example:

Customer says:

Need enterprise Wi-Fi for warehouse.

Semantic search can find previous:

warehouse Wi-Fi projects

relevant Aruba/Ubiquiti knowledge

similar enquiries

Relationship retrieval

If Product X relates to Supplier Y and Enquiry Z, retrieve those relationships directly.

Semantic vectors should complement relational data, not replace it.

44. Agent Learning

The requirement that agents should improve through use must not mean allowing an LLM to continually rewrite its own system instructions.

That would create unpredictable drift.

Instead use a controlled learning loop.

Conversation

↓

Outcome

↓

Candidate Learning Extraction

↓

Evidence Check

↓

Memory Classification

↓

Store Memory

↓

Reuse on next interaction

↓

Repeated pattern detected

↓

Skill Improvement Proposal

↓

Approved / promoted skill revision

This creates real improvement without giving agents uncontrolled authority to change themselves.

45. Automatic Learning

Low-risk information can be learned automatically.

Examples:

Product aliases.

Supplier category association.

Terminology.

Repeated customer naming.

Previously confirmed mappings.

Search vocabulary.

46. Controlled Learning

Higher-risk procedural changes should become:

Skill Improvement Proposal

Example:

Agent notices repeatedly that a particular server comparison requires checking RAID controller compatibility.

It proposes:

Add RAID-controller compatibility verification to the HPE Server Procurement skill.

Admin can:

Approve

Modify

Reject

Once approved:

Skill version 1.3 → 1.4.

This creates measurable agent improvement.

47. Agent Performance Memory

Track agent interactions.

Store:

task type

output

corrections

accepted/rejected suggestions

tool calls

outcome

user feedback

relevant skill version

model/provider used

Over time this can identify:

weak skills

common corrections

missing tools

poor extraction patterns

provider performance differences

48. LLM Provider Abstraction

The application must not be tightly coupled to one LLM.

Create an interface such as:

LLMProvider

Capabilities:

generateText()

generateStructured()

embed()

stream()

toolCall()

Different provider adapters can implement the interface.

49. Provider Settings

Settings → AI Providers

Allow configuration of:

Provider name

Provider type

API endpoint

API key

Default model

Embedding model

Context window

Maximum output

Enabled capabilities

Enabled/disabled

Default status

Possible provider types:

OpenAI

Anthropic

Google Gemini

OpenAI-compatible endpoint

Local model

Future providers

Each agent can use:

System default

or:

Agent-specific provider/model.

50. API Key Security

Never store visible API keys as ordinary plaintext settings.

Use encrypted secret storage.

Application encryption key should remain outside the database.

The UI should only show:

••••••••••••abcd

Support:

Test Connection

Update Key

Disable Provider

Delete Provider

51. Agent Conversations

Agent chat should look like a workspace rather than a consumer chatbot.

Each conversation should support entity context.

Examples:

Chat inside:

Supplier ABC

Product XYZ

Enquiry ENQ-00124

Customer X

The agent automatically receives relevant entity context through the Context Builder.

52. Agent Conversation Storage

Persist:

conversation

thread

messages

agent

model

provider

tokens where available

tool calls

tool results

sources retrieved

memory references

resulting actions

This creates reproducibility.

53. Supplier Search

Supplier search should support:

Company

Contact

Brand

Category

Product

Part number

Location

Broadcast content

Stock

Payment terms

Credit

Search example:

Lenovo Dubai stockist 30 days credit

could retrieve suppliers based on structured attributes and knowledge.

54. Procurement Search

Global procurement search will eventually become one of the most important application functions.

Search:

83A100SUAK

Return:

Canonical product

Aliases

Latest supplier observations

Stock

Prices

Observation freshness

Broadcasts

Previous enquiries

Previous quotations

Relevant knowledge

55. Sourcing Workspace

Once an enquiry product is identified:

Source Product

shows existing business intelligence.

Example:

Dell Latitude 5450

Supplier A
AED 2,450
20 units
Observed 3 hours ago

Supplier B
AED 2,475
Unknown stock
Observed yesterday

Supplier C
AED 2,390
5 units
Observed 18 days ago

The user then decides whether fresh RFQs are needed.

56. RFQ Management

Generate supplier RFQ drafts from enquiry requirements.

Track supplier-specific status:

Draft

Sent

Waiting

Responded

No Stock

Declined

Follow-Up

Expired

The user should immediately see:

Waiting for responses from 4 suppliers.

57. Procurement Decision Workspace

Compare supplier evidence.

Relevant comparison attributes:

Price

Quantity

Price freshness

Stock freshness

Warranty

UAE/import stock

Credit

Payment terms

Delivery

Lead time

Relationship

Supplier reliability evidence

The application organizes the information.

The user selects the supplier.

58. Procurement Decision Snapshot

Preserve the information available when the decision was made.

Example:

Selected Supplier B

AED 2,475

200 units confirmed

UAE warranty

30-day credit

same-day delivery

Supplier A:

AED 2,430

only 35 units

This prevents later confusion over why the apparently cheapest supplier was not selected.

59. Quotation Management

Once sourcing is complete:

Cost



Freight



Delivery



Installation



Other costs



Margin

=

Selling price

Quotation records must support:

revisions

VAT

payment terms

delivery

validity

warranty

customer-facing description

internal procurement notes

Never expose internal supplier cost or margins in customer output.

60. Quotation Revisioning

Never overwrite quotations.

Example:

Q-2026-00145

Revision 1

Revision 2

Revision 3

Preserve:

previous prices

descriptions

quantities

terms

who changed the revision

timestamps

61. Activity Timeline

Important entities should have timelines.

Example enquiry:

09:20 Email detected

09:21 Classified as RFQ

09:22 Enquiry created

09:25 Product identified

09:30 Existing supplier evidence found

09:35 Supplier RFQs created

10:10 Supplier A replied

10:14 Supplier B replied

10:25 Procurement option selected

10:45 Quotation created

Next Action: Customer follow-up tomorrow

62. Knowledge Base

Knowledge should not become a folder full of disconnected notes.

Knowledge must be linked to entities.

Possible relationships:

Knowledge → Supplier

Knowledge → Brand

Knowledge → Product

Knowledge → Category

Knowledge → Customer

Knowledge → Agent Skill

Knowledge → Workflow

Knowledge → Enquiry

This allows context-aware retrieval.

63. Application Architecture

Recommended initial stack:

Frontend / Application

Next.js

TypeScript

React

Tailwind CSS

shadcn/ui

Backend

Next.js server-side application/service layer

Modular Monolith

Database

PostgreSQL

Prisma ORM

pgvector extension when semantic memory becomes active

Local Infrastructure

Docker Compose

PostgreSQL container

Application development server

Optional worker process

Do not introduce Kubernetes or microservices.

64. Background Processing

Email synchronization, broadcast parsing, embeddings and imports should not block HTTP requests.

Use background jobs.

Initial architecture can use:

PostgreSQL-backed jobs

or a lightweight PostgreSQL job queue.

Avoid introducing Redis until scale actually requires it.

Examples of jobs:

SYNC_EMAIL_ACCOUNT

PROCESS_EMAIL

CLASSIFY_EMAIL

PARSE_ENQUIRY

PARSE_BROADCAST

CREATE_EMBEDDING

PROCESS_IMPORT

SUMMARIZE_AGENT_SESSION

EXTRACT_LEARNINGS

65. Suggested Project Structure

src/
  app/
    (auth)/
    (workspace)/
    api/

  modules/
    agents/
    audit/
    broadcasts/
    customers/
    enquiries/
    evidence/
    integrations/
    knowledge/
    llm/
    memory/
    products/
    procurement/
    quotations/
    rfq/
    search/
    settings/
    sourcing/
    suppliers/

  components/
    application/
    data-table/
    forms/
    navigation/
    ui/

  core/
    auth/
    business-rules/
    context/
    permissions/
    tool-registry/
    validation/

  integrations/
    email/
      imap/
      parsers/
      classifiers/
      dictionaries/

  workers/

  lib/

prisma/

docs/
  product/
  architecture/
  design/
  modules/
  plans/
    active/
      CURRENT.md
  decisions/
  quality/
  ideas/
    BACKLOG.md

agents/
skills/

66. Controlled Development Documentation

Do not create one enormous permanent master prompt.

Use focused instruction files.

Root instruction

CLAUDE.md

Contains only global development rules.

Agent operating guide

AGENTS.md

Explains agent responsibilities and delegation rules.

Architecture

docs/architecture/

Architecture decisions.

Modules

docs/modules/

One focused file per module.

Current development

docs/plans/active/CURRENT.md

There should be one active implementation plan.

Backlog

docs/ideas/BACKLOG.md

Interesting ideas that are not currently authorized for implementation.

Decisions

docs/decisions/

Architecture Decision Records.

This keeps AI coding context small and controlled.

67. Development Agent Roles

Do not create unnecessary agents.

Initial coding workflow can use:

Primary Implementation Agent

Owns implementation of the current vertical slice.

Architecture Reviewer

Reviews architectural impact.

Database Reviewer

Reviews schema and data integrity.

UI Reviewer

Reviews enterprise UI consistency.

Security Reviewer

Used when authentication, credentials, permissions or external integrations are involved.

Code Reviewer

Used at capability milestones.

Agents do not independently create new product requirements.

68. UI Design Direction

The application should feel:

Premium

Thin

Enterprise

Dense

Professional

Fast

Avoid typical oversized SaaS dashboards.

Avoid excessive gradients.

Avoid huge rounded cards.

Avoid decorative widgets.

Avoid unnecessary animations.

69. UI Visual Rules

Use:

thin borders

subtle shadows

restrained radius

compact controls

high-quality typography

strong hierarchy

spacious but information-dense layouts

muted secondary text

meaningful status colors only

consistent table spacing

excellent hover/focus states

Primary design emphasis:

Tables

Search

Filters

Drawers

Panels

Tabs

Command menus

Inline actions

Context menus

Badges

Timelines

70. Typography

Recommended:

Geist

Approximate hierarchy:

Page title
20–24px

Section heading
15–17px

Body
13–14px

Table content
12–13px

Metadata
11–12px

Avoid unnecessarily large typography.

71. Primary Navigation

ZERONIX
INTELLIGENCE

Overview

INTELLIGENCE
Agents
Second Brain

PROCUREMENT
Enquiries
Sourcing
Products
Suppliers
Broadcasts
RFQs

COMMERCIAL
Quotations
Follow-ups

KNOWLEDGE
Prices & Stock
Knowledge
Imports

ADMIN
Users
Integrations
AI Providers
Dictionaries
Audit
Settings

72. Global Search

Global search should eventually be accessible from anywhere.

Shortcut:

⌘ K / Ctrl K

It should search:

products

part numbers

suppliers

contacts

customers

enquiries

quotations

broadcasts

knowledge

agent conversations

73. Supplier Screen

Primary presentation should be a high-quality table.

Example:

SUPPLIERS                                           + ADD SUPPLIER

Search suppliers...

Brand ▼    Category ▼    Type ▼    Location ▼

Supplier             Focus            Last Evidence      Terms
───────────────────────────────────────────────────────────────
ABC Computers        Dell / HP        2h ago             COD
XYZ Trading          Lenovo           1d ago             30 Days
Tech Distribution    HPE / Aruba      4d ago             Credit

74. Supplier Detail

Suggested tabs:

Overview

Contacts

Broadcasts

Products

Prices

Stock

RFQs

Knowledge

Activity

Example overview:

ABC COMPUTERS
Stockist · Dubai

Brands
Dell · HP · Lenovo

Procurement Profile
Payment       30 Days
Warranty      UAE
Delivery      Same Day
Last Evidence 2 Hours Ago

RECENT OBSERVATIONS

Latitude 5450       AED 2,450      20 pcs      3h
Vostro 3530         AED 1,720      40 pcs      1d

75. Broadcast Workspace

This should become one of the fastest workflows in the application.

NEW SUPPLIER BROADCAST

Supplier     [ ABC Computers ▼ ]
Contact      [ Ahmed ▼ ]

┌────────────────────────────┬──────────────────────────────┐
│ RAW MESSAGE                │ EXTRACTED ITEMS              │
│                            │                              │
│ Dell 5440                  │ Dell Latitude 5440           │
│ i7 16/512                  │ i7-1355U · 16GB · 512GB     │
│ 25pcs                      │                              │
│ 2450+                      │ AED 2,450 · 25 pcs          │
│                            │                              │
│                            │ MATCHED                      │
│                            │                              │
│                            │ Confirm   Edit               │
└────────────────────────────┴──────────────────────────────┘

76. Enquiry Inbox

Do not create a generic Kanban board as the primary UI.

Use an operational enquiry inbox.

ENQUIRIES

Needs Attention | New | Sourcing | Waiting Supplier | Quote Ready

Source   Customer     Requirement             Status             Age
Email    ABC LLC      200 × Dell laptops      NEW                14m
Manual   XYZ LLC      HPE server              SOURCING           1h
Email    QRS LLC      15 APs + switches       WAITING SUPPLIER   3h

Focus on:

requirement

source

owner

blocker

next action

age

77. Settings — AI Providers

Example:

AI PROVIDERS

OpenAI
Status: Connected
Default Model: GPT-5.x

Anthropic
Status: Connected
Default Model: Claude

Gemini
Status: Connected
Default Model: Gemini

Local / OpenAI Compatible
Status: Disabled

Each agent can override the default.

78. Agent Builder UI

Agent creation should remain straightforward.

Sections:

Identity

Purpose

Skills

Tools

Business Scope

Memory

Model

Approvals

Example:

Agent
Zeronix Procurement Agent

Purpose
Analyze enquiries and supplier intelligence to support sourcing.

Skills
✓ Product Matching
✓ Supplier Search
✓ Broadcast Interpretation
✓ RFQ Preparation

Tools
✓ Search Products
✓ Search Suppliers
✓ Read Price Observations
✓ Read Stock Observations
✓ Create RFQ Draft

Model
Claude / OpenAI / Gemini / Custom

Memory
Procurement + Products + Suppliers

79. Security and Permissions

Sensitive fields should be permission-controlled.

Examples:

Supplier cost

Credit limits

Margins

API credentials

Customer commercial history

Agent tools should respect the same permission system as humans.

An agent must never gain greater authority than the user invoking it.

80. Audit

Audit important actions.

Store:

Actor

User / Agent

Action

Entity

Before

After

Timestamp

Tool

Source conversation where applicable

Especially audit:

price modifications

product matching

supplier changes

margin changes

supplier selection

quotation changes

agent tool actions

skill changes

permission changes

81. Initial Database Domains

Likely core entities:

User
Role
Permission

Supplier
SupplierContact
SupplierBrand
SupplierCategory
SupplierTerm

Brand
Category
Product
ProductAlias
ProductSpecification

Broadcast
BroadcastItem

PriceObservation
StockObservation
EvidenceSource

Customer
CustomerContact

Enquiry
EnquiryItem
EnquirySource
EnquiryActivity

ProductMatch

SourcingSession
SourcingCandidate
ProcurementDecision

RFQ
RFQSupplier
RFQResponse

Quotation
QuotationRevision
QuotationItem

FollowUp
Activity

Agent
AgentSkill
AgentSkillVersion
AgentConversation
AgentMessage
AgentRun
AgentToolCall

LLMProvider
LLMModel

Memory
KnowledgeEntry
EntityRelationship

EmailAccount
EmailMessage
EmailAttachment
EmailClassification

Dictionary
DictionaryTerm

Job

ImportJob

AuditLog

The schema must be properly designed before generating all migrations.

82. Phase 0 — Architecture Foundation

Implement:

repository structure

Docker Compose

PostgreSQL

Prisma

migration system

basic authentication

roles foundation

application shell

navigation

shared UI components

audit foundation

tool registry foundation

Do not spend excessive time perfecting these foundations.

83. Phase 1 — Supplier Intelligence

Complete fully:

suppliers

supplier contacts

brands

categories

procurement profile

terms

search

filtering

supplier detail

notes

activity

audit

This should be genuinely usable.

84. Phase 2 — Supplier Broadcast Intelligence

Complete:

manual broadcast entry

raw message preservation

supplier association

extraction

review

multiple-item support

product linking

temporary products

price observations

stock observations

evidence drawer

This is the first major intelligence vertical slice.

85. Phase 3 — Enquiry Intelligence

Implement:

manual enquiry

email account configuration

IMAP synchronization

email storage

generic dictionaries

deterministic RFQ classification

candidate scoring

enquiry review inbox

enquiry creation

requirement extraction

enquiry item structure

activity timeline

Do not introduce WhatsApp yet.

86. Phase 4 — Product Intelligence

Complete:

product master

aliases

specifications

matching rules

temporary products

match review

correction learning

87. Phase 5 — Procurement Search

Build the first powerful cross-system search.

Product

↓

Suppliers

↓

Stock

↓

Price

↓

Freshness

↓

Evidence

↓

Broadcast

This is when collected information becomes immediately valuable.

88. Phase 6 — Second Brain Foundation

Implement:

memory model

knowledge model

entity relationships

full-text retrieval

pgvector

Context Builder

provenance

memory retrieval policies

89. Phase 7 — Multi-Agent Platform

Implement:

agent registry

agent builder

skill registry

skill versions

tool registry

agent chat

provider selection

context building

tool execution

conversation persistence

learning extraction

90. Phase 8 — Sourcing and RFQ

Implement:

sourcing workspace

supplier candidates

existing evidence

RFQ generation

responses

supplier comparison

procurement decision snapshot

91. Phase 9 — Quotation

Implement:

pricing workspace

margins

quotation generation

revisioning

customer output

permissions

follow-up

92. Phase 10 — Additional Channels

Only after email and manual workflows are stable:

contact forms

WhatsApp API

supplier WhatsApp ingestion

supplier email broadcasts

Excel price sheets

supplier portals

website sourcing

APIs

93. Phase 11 — Advanced Intelligence

Later capabilities can include:

Supplier response analytics

Price trend intelligence

Supplier coverage gaps

Product demand intelligence

Quotation conversion

Lost enquiry reasons

Procurement bottlenecks

Supplier reliability history

Market changes

AI-assisted sourcing research

These require enough quality historical data first.

94. Current Development Priority

The immediate target should not be the entire application.

The first meaningful working system should support:

Supplier workflow

Create Supplier

↓

Create Contacts

↓

Configure Brands / Categories

↓

Paste Supplier Broadcast

↓

Extract Products

↓

Review

↓

Confirm

↓

Create Price / Stock Observations

↓

Search Product

↓

See Supplier Evidence

Enquiry workflow

Connect Email Account

↓

Sync Email

↓

Dictionary Classification

↓

Identify Potential RFQ

↓

Create Enquiry Candidate

↓

Extract Requirement

↓

Review

↓

Create Enquiry

↓

Search Existing Supplier Intelligence

This creates a closed loop between:

CUSTOMER DEMAND

and:

SUPPLIER INTELLIGENCE

That is the first major Zeronix Intelligence milestone.

95. Testing Strategy During Initial Development

Current priority is completing real workflows.

Do not build an enormous testing framework before usable functionality exists.

During development require:

TypeScript compilation

linting

database migration validation

critical schema validation

basic integration checks

critical save/read validation

obvious runtime verification

Use deeper tests when a capability becomes stable.

Heavy test coverage can be expanded before production rollout.

96. Definition of Completion

A feature is not complete because the UI exists.

Each vertical slice should include:

Database

Business logic

Permissions

UI

Validation

Evidence handling

Audit where relevant

Error handling

Basic verification

The goal is working capability rather than disconnected screens.

97. Architectural Rules

The following should be treated as long-term project rules:

PostgreSQL is the primary system of record.

AI is replaceable.

LLM chat history is never the company's memory system.

Business evidence must remain traceable.

Prices and stock are time-aware observations.

Historical commercial information is not silently overwritten.

Unknown values remain unknown.

Deterministic logic comes before LLM reasoning where practical.

Agents use controlled tools rather than direct database access.

Agent skills are versioned.

Agent learning must preserve provenance.

Core business policies cannot be automatically rewritten by an agent.

Human authorization controls important external actions.

Use a modular monolith initially.

Build vertical slices.

Avoid premature infrastructure.

Keep development instructions focused and contextual.

Maintain one active implementation plan.

98. Strategic End State

Over time Zeronix Intelligence should develop three increasingly valuable assets.

Data Asset

Structured history of:

suppliers

products

prices

stock

customers

enquiries

quotations

procurement outcomes

Knowledge Asset

Accumulated understanding of:

who supplies what

market terminology

supplier strengths

product relationships

sourcing patterns

technical knowledge

operational procedures

Intelligence Asset

Specialized Zeronix agents capable of using those first two assets to assist employees.

This means competitive advantage comes not from the LLM provider itself.

The LLM can be replaced.

The competitive advantage becomes:

Zeronix's structured evidence + organizational memory + workflows + learned skills + business relationships.

99. Final System Principle

Zeronix Intelligence should not attempt to become intelligent because a powerful LLM has been connected to it.

The application should first become a reliable system for capturing what Zeronix knows.

Then AI should reason over that knowledge.

Therefore the architecture should remain:

Evidence → Structure → Memory → Retrieval → Intelligence → Human Decision → Learning

rather than:

Prompt → LLM → Hope the LLM remembers.

That distinction should guide the entire development of Zeronix Intelligence.