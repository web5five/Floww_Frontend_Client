# Required demo evidence

This checklist is the final integrated demo target, not a claim that this client PR satisfies it.

| Positive-path step | Current client capability / missing evidence |
| --- | --- |
| Wallet authentication | Server nonce/verify adapter; deployment and real extension acceptance still separate |
| Task/Mandate | Input/draft-review UI; final persisted/versioned authority contract pending |
| Three pharmacy quotes | Synthetic comparison preview only; operational quotes pending |
| Kiln qwen3-32b proposal | Draft API adapter; pharmacy proposal-to-task integration pending |
| Policy ALLOW | Mock policy and test execution display only; actual signing-boundary result needed |
| User approval | Local demo confirmation only; final EIP-712 approval contract pending |
| Smart Account execution | Not connected |
| Real Sepolia fUSDC transaction | Not executed by this client |
| Transaction hash and confirmed receipt | No fabricated hash; actual backend evidence required |
| Simulated fulfillment | Merchant result not connected |
| Fulfillment verification | Independent backend verification not connected |
| Task COMPLETED | Must follow verified fulfillment, never inferred from payment or model text |

Required blocked runs:

1. Over budget -> DENY -> reason logged -> no signing -> no broadcast -> no transaction hash.
2. Wrong recipient -> DENY -> reason logged -> no signing -> no broadcast -> no transaction hash.

Here, no signing refers to a denied payment action, not the earlier wallet-authentication signature. Existing local budget/merchant tests do not prove executor enforcement. Absence of a transaction hash in UI alone is not no-broadcast proof. Capture server policy records, executor/signing-boundary evidence and exact component revisions for both attempts. Unknown payment must remain unknown until reconciliation; never use retry to silently submit another payment.

Client handoff required: authoritative task/mandate/attempt IDs and versions, selected quote/merchant/recipient, base-unit amount and token/chain, server-verified authority, execution events, payment/receipt and fulfillment verification states. Do not invent endpoints or success results while that contract is pending.

Integration constraints for the next adapter: camelCase taskId/mandateId/version/attemptId; integer base-unit monetary strings; task-wide cumulative spending limits; EIP-712 approval bound to the selected merchant/quote and mandate version; registry-resolved recipients; attempt-level DENY separate from task termination. Existing legacy test APIs and the numeric Nike fixture are compatibility/demo surfaces, not the new financial contract. The client does not invent a five-attempt task engine or activate authority while actual server DTOs and verification endpoints are unavailable.
