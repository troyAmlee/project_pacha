import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useClubData } from "../context/ClubDataContext";
import { toTitleCase } from "../utils";
import RiderAvatar from "./RiderAvatar";
import RiderLink from "./RiderLink";

export default function MemberRoster() {
  const { member } = useAuth();
  const { data } = useClubData();

  return (
    <section className="content-section content-section--split" id="join">
      <div className="section-heading">
        <p className="section-kicker">Club roster</p>
        <h2>Riders join with a profile that feels more like a crew than a signup form.</h2>
        <p>
          The roster gathers the people in the community, their neighborhood, their ride pace,
          and what kind of riding they are here for.
        </p>
      </div>

      <div className="section-body section-body--split">
        <div className="editor editor--warm roster-welcome">
          {member ? (
            <>
              <h3>You are riding with the crew, {member.name}.</h3>
              <p>
                Your profile is live on the roster. Every route, photo, journal post, group, and
                ride log is credited to you.
              </p>
            </>
          ) : (
            <>
              <h3>Join the North Star crew.</h3>
              <p>
                Create a rider profile to share routes, post ride photos, join groups, and write in
                the club journal.
              </p>
              <div className="locked-note__actions">
                <Link className="button button--primary" to="/signup">
                  Create account
                </Link>
                <Link className="button button--outline" to="/login">
                  Log in
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="member-rail">
          {data.members.map((rider) => (
            <article className="member-chip" key={rider.id}>
              <RiderAvatar className="member-avatar" rider={rider} />
              <div>
                <h3>
                  <RiderLink riderId={rider.id} name={rider.name} />
                </h3>
                <p>
                  {rider.neighborhood} - {toTitleCase(rider.pace)}
                </p>
                <span>{rider.bio}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
