export const CONSTITUTION_VERSION = "2.0";

export function ConstitutionContent() {
  return (
    <div className="legal-content">
      <p className="text-navy-400 text-sm mb-6">Version {CONSTITUTION_VERSION}</p>

      <h2>1. Name and purpose</h2>
      <p>
        This is the constitution of <strong>Vuma Private</strong>, a private cost-sharing club for
        Vuma members. Its purpose is simple: to help members ask their own private circle — a
        church group, a workplace, a neighbourhood, a school run — <em>"who's already going, and has
        space?"</em> This is not a way to hire a driver. It connects members of a private group who
        already know each other, so a driver already making a trip can share the actual cost of that
        trip with others in their group who need to go the same way. Vuma Private is administered by
        Vuma as part of the Vuma platform; it is not a separate legal entity unless and until Vuma
        states otherwise.
      </p>

      <h2>2. Ride Request Notice</h2>
      <p>
        <strong>
          This feature connects members of a private group who already know each other. The person
          requesting a ride is not employing a driver. If a driver volunteers, both parties are
          agreeing to share the costs of a trip the driver was already planning to make. This does not
          create an employer-employee or commercial transport relationship.
        </strong>
      </p>

      <h2>3. Membership</h2>
      <p>
        Membership is open to any Vuma user who accepts this constitution. A member's status may be{" "}
        <strong>pending</strong> (constitution accepted, awaiting confirmation of any applicable fee) or{" "}
        <strong>active</strong> ("paid up"). Only active members can create or join a group, post a
        trip request, or make a cost-share offer. Vuma may set, and change, any membership fee
        required to become or remain an active member, and will communicate the current amount and
        whether it is charged monthly or per trip before it is charged.
      </p>

      <h2>4. Groups</h2>
      <p>
        A group is a private circle — invite-only, visible only to its own members. A trip request
        posted inside a group is never shown outside it, and is never publicly advertised anywhere on
        Vuma. Any active member may create a group and invite others to it using that group's invite
        code.
      </p>

      <h2>5. Group rules</h2>
      <ol>
        <li>This is for members of your private group only.</li>
        <li>Drivers volunteer their own car and trip. No one can be "hired."</li>
        <li>Only actual costs are shared: fuel, tolls, parking.</li>
        <li>The driver is responsible for holding a valid licence and appropriate insurance.</li>
      </ol>

      <h2>6. How a trip request works</h2>
      <p>
        A member posts a trip request inside a group: where they're going, when, how many seats they
        need, and an optional note. Any other member of that same group who is already making that
        trip may reply with an offer: how many seats they have available, their honestly estimated
        total cost for the trip (fuel, tolls, parking), and the resulting cost per person. Vuma's
        cost-split calculator computes this split automatically and does not allow a driver to enter a
        per-person amount that adds up to more than the estimated total cost — there is no markup, and
        no way to add one. The requester chooses which offer, if any, to accept; accepting locks the
        seats and confirms the split.
      </p>

      <h2>7. Membership fee</h2>
      <p>
        Where a fee applies, it is charged and described to members as a <strong>membership fee</strong>{" "}
        — never as a commission, and never as a percentage of any trip's cost. It is deducted from a
        member's Vuma Wallet balance, monthly or per trip depending on Vuma's current fee structure,
        which is disclosed to members before it changes.
      </p>

      <h2>8. Member conduct</h2>
      <p>As a member, you agree to:</p>
      <ul>
        <li>Only post or respond to a trip request within a group you're a genuine member of.</li>
        <li>Only offer a trip you are already planning to make yourself — never one arranged solely to fulfil someone else's request.</li>
        <li>Estimate costs honestly, and never seek to profit from a cost-share split.</li>
        <li>Hold a valid driver's licence and appropriate insurance before offering to drive.</li>
        <li>Comply with Vuma's general Terms of Service at all times.</li>
      </ul>

      <h2>9. Administration and governance</h2>
      <p>
        Vuma administers Vuma Private, including approving membership, confirming paid-up status, and
        overseeing groups and trip activity for safety and compliance with this constitution.
        Governance of Vuma Private rests fully with Vuma; no separate member body, committee, or
        elected representation currently exists.
      </p>

      <h2>10. Suspension and termination of membership</h2>
      <p>
        Vuma may suspend or terminate a member's status for a breach of this constitution — including
        misuse of a trip request or offer to seek profit, or fabricating a trip that was never
        genuinely planned — the Vuma Terms of Service, or non-payment of any applicable fee, with a
        reason communicated to the member. Termination of Vuma Private membership does not itself
        affect a person's underlying Vuma account, which remains governed separately by the Vuma Terms
        of Service.
      </p>

      <h2>11. Amendments</h2>
      <p>
        Vuma may amend this constitution from time to time. A new version takes effect for new members
        upon publication; existing members will be asked to accept a materially changed version before
        continuing to use Vuma Private.
      </p>

      <h2>12. Acceptance</h2>
      <p>
        By accepting this constitution, you apply to join Vuma Private on the terms above, and agree
        to abide by them for as long as you remain a member.
      </p>
    </div>
  );
}
