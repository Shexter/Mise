## Purpose

Governs how the app picks a vision provider from the user's own API key, talks
to it, and explains failures. The user pastes one key and the app works out the
rest — so detection has to be unambiguous, and a rejected key has to be
distinguishable from a misrouted one.

## ADDED Requirements

### Requirement: The provider is detected from the key's shape

The system SHALL determine which provider a key belongs to from the key itself,
without asking the user to choose.

Detection SHALL test more specific key prefixes before less specific ones. Where
one provider's prefix is a prefix of another's, the longer prefix MUST be tested
first.

#### Scenario: An Anthropic key is not captured by the OpenAI prefix

- **GIVEN** Anthropic keys begin `sk-ant-` and OpenAI keys begin `sk-`
- **WHEN** a key beginning `sk-ant-` is detected
- **THEN** the provider is Anthropic
- **AND** the key is not routed to OpenAI

#### Scenario: An OpenAI key is detected

- **WHEN** a key beginning `sk-proj-` or `sk-` but not `sk-ant-` is detected
- **THEN** the provider is OpenAI

#### Scenario: A Google key is detected

- **WHEN** a key beginning `AIza` or `AQ.` is detected
- **THEN** the provider is Google

### Requirement: Unrecognised keys are reported, not guessed

The system SHALL NOT assign a provider to a key whose shape matches no known
provider. An unrecognised key SHALL produce an explicit unrecognised result, and
the user SHALL be told the key was not recognised rather than being shown a
failure from an arbitrarily chosen provider.

#### Scenario: An unknown key shape is refused

- **WHEN** a key matching no known provider prefix is entered
- **THEN** the system reports that the key was not recognised
- **AND** no request is sent to any provider

#### Scenario: The user is told what shapes are accepted

- **WHEN** an unrecognised key is entered
- **THEN** the message names the key formats the app accepts

### Requirement: Every provider satisfies the same transport contract

Each supported provider SHALL expose the same two operations: estimate a meal
from a base64-encoded JPEG returning the model's raw text, and verify a key.

Providers SHALL share one estimation prompt and one response format, so that a
change of provider does not change what the rest of the app receives.

#### Scenario: Estimates have the same shape across providers

- **WHEN** the same photo is estimated with any supported provider
- **THEN** the returned text is parsed by the same shared parser
- **AND** downstream code does not branch on which provider produced it

#### Scenario: Adding a provider does not change existing ones

- **WHEN** a new provider is added
- **THEN** the existing providers' request and error handling are unchanged

### Requirement: Dispatch to a provider is total

The system SHALL route a request to the transport for the detected provider such
that adding a provider to the supported set without providing its transport is
rejected before the code runs.

#### Scenario: Every supported provider has a transport

- **WHEN** the set of supported providers is extended
- **THEN** a provider without a corresponding transport is a compile-time error

### Requirement: Key verification does not spend generation quota

The system SHALL verify a key using the cheapest operation the provider offers
that still proves the key is valid, preferring an operation that consumes no
generation quota.

Verification SHALL distinguish a rejected key from an unreachable service, and
report each differently.

#### Scenario: Verification avoids a generation request where possible

- **WHEN** a key is verified for a provider that offers a model-listing endpoint
- **THEN** verification uses that endpoint rather than requesting an estimate

#### Scenario: A rejected key is distinguished from a network failure

- **WHEN** verification fails because the service could not be reached
- **THEN** the result reports a connectivity failure, not a rejected key

### Requirement: Provider failures map onto one shared error taxonomy

Each provider SHALL translate its own failure responses into the app's shared
error kinds, so that callers handle failures uniformly regardless of provider.

An out-of-credit or exhausted-quota condition SHALL be reported as a billing
failure, distinctly from a temporary rate limit, even where a provider returns
the same status code for both.

#### Scenario: Exhausted quota is not misreported as a rate limit

- **GIVEN** a provider that returns the same status code for rate limiting and
  for exhausted quota
- **WHEN** the response indicates the account is out of credit
- **THEN** the failure is reported as a billing failure
- **AND** not as a temporary rate limit

#### Scenario: A temporary rate limit invites a retry

- **WHEN** a provider reports a temporary rate limit
- **THEN** the failure is reported as rate limited
- **AND** the suggested action is to retry

#### Scenario: An unauthorised response is reported as a rejected key

- **WHEN** a provider rejects the credentials
- **THEN** the failure is reported as a rejected key
- **AND** the suggested action directs the user to Settings

### Requirement: Error messages name the user's own provider

Where an error message refers to a provider — its account, its billing page, or
its limits — the message SHALL refer to the provider the user's key actually
belongs to.

A message MUST NOT name one provider when the user's key belongs to another.

#### Scenario: Billing copy follows the key

- **GIVEN** the stored key belongs to OpenAI
- **WHEN** a billing failure occurs
- **THEN** the message refers to the OpenAI account and its billing location
- **AND** does not mention Anthropic

#### Scenario: Provider-neutral errors stay neutral

- **WHEN** a network or timeout failure occurs
- **THEN** the message does not name any provider

### Requirement: Key entry reflects the supported providers

The key entry surface SHALL accept a key from any supported provider, and its
placeholder, guidance, validation message, and console links SHALL be derived
from the supported provider list rather than written out per provider.

Where a provider offers a free tier, the guidance SHALL identify which one, so a
user without a funded account can still use the app.

#### Scenario: A newly supported provider appears without further edits

- **WHEN** a provider is added to the supported list with its console link
- **THEN** the key entry surface offers it without separate changes to that
  surface's copy

#### Scenario: The free option is identifiable

- **WHEN** the user opens the key entry guidance
- **THEN** the provider with a free tier is identified as such

#### Scenario: Validation accepts any supported provider's key

- **WHEN** a well-formed key from any supported provider is entered
- **THEN** it passes shape validation and can be saved

### Requirement: Key storage is unaffected by provider support

Adding or changing supported providers SHALL NOT change where or how the key is
stored, and SHALL NOT require an existing user to re-enter a working key.

#### Scenario: An existing key keeps working

- **GIVEN** an install with a previously saved working key
- **WHEN** the app is updated with a new provider supported
- **THEN** the saved key is still found and still works
- **AND** the user is not prompted to re-enter it
