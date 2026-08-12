export const CONSTITUTION_VERSION = "1.0";

export function ConstitutionContent() {
  return (
    <div className="legal-content">
      <p className="text-navy-400 text-sm mb-6">Version {CONSTITUTION_VERSION}</p>

      <h2>1. Name and purpose</h2>
      <p>
        This is the constitution of <strong>Vuma Associates</strong>, a membership-based networking
        society for Vuma riders and drivers. Its purpose is to help members support one another with
        transportation needs, entrepreneurship ideas, and mentorship toward personal and business
        success. Vuma Associates is administered by Vuma as part of the Vuma platform; it is not a
        separate legal entity unless and until Vuma states otherwise.
      </p>

      <h2>2. Membership</h2>
      <p>
        Membership is open to any Vuma rider or driver who accepts this constitution. A member's
        status may be <strong>pending</strong> (constitution accepted, awaiting confirmation of any
        applicable dues) or <strong>active</strong> ("paid up"). Only active members receive the
        benefits described in Section 3. Vuma may set, and change, any dues or fees required to become
        or remain an active member, and will communicate the current amount before it is charged.
      </p>

      <h2>3. Member benefits</h2>
      <p>Benefits available to active (paid-up) members currently include:</p>
      <ul>
        <li>
          The ability to top up a personal Vuma Wallet balance directly, for use toward ride fares —
          separate from, and not subject to, the caps that apply to wallet credit earned through a
          driver's change-giving.
        </li>
        <li>
          Access to rides, or categories of rides such as Vuma Deluxe, during periods Vuma may from
          time to time reserve for active members only.
        </li>
      </ul>
      <p>
        <strong>Further benefits — including structured mentorship, entrepreneurship resources, and
        mutual-support programs among members — will be added over time.</strong> This constitution
        does not guarantee any specific benefit beyond what is currently offered, and Vuma may add,
        change, or discontinue a benefit at its discretion, with reasonable notice to members where
        practical.
      </p>

      <h2>4. Member conduct</h2>
      <p>As a member, you agree to:</p>
      <ul>
        <li>Engage with other members honestly and respectfully.</li>
        <li>Use any mentorship, networking, or support benefit for its genuine intended purpose.</li>
        <li>Comply with Vuma's general Terms of Service at all times.</li>
        <li>Not use membership status to misrepresent an affiliation, endorsement, or authority you do not have.</li>
      </ul>

      <h2>5. Administration and governance</h2>
      <p>
        Vuma administers Vuma Associates, including approving membership, confirming paid-up status,
        and deciding when and how any member-restricted access (such as a members-only period for
        certain rides) applies. Governance of Vuma Associates rests fully with Vuma; no separate
        member body, committee, or elected representation currently exists.
      </p>

      <h2>6. Suspension and termination of membership</h2>
      <p>
        Vuma may suspend or terminate a member's status for a breach of this constitution, the Vuma
        Terms of Service, or for non-payment of any applicable dues, with a reason communicated to the
        member. Termination of membership does not itself affect a person's underlying Vuma rider or
        driver account, which remains governed separately by the Vuma Terms of Service.
      </p>

      <h2>7. Amendments</h2>
      <p>
        Vuma may amend this constitution from time to time. A new version takes effect for new members
        upon publication; existing members will be asked to accept a materially changed version before
        continuing to receive member benefits.
      </p>

      <h2>8. Acceptance</h2>
      <p>
        By accepting this constitution, you apply to join Vuma Associates on the terms above, and
        agree to abide by them for as long as you remain a member.
      </p>
    </div>
  );
}
