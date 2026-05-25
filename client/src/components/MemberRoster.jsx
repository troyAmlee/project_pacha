import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useClubData } from "../context/ClubDataContext";
import { useTranslation } from "../i18n";
import { toTitleCase } from "../utils";
import RiderAvatar from "./RiderAvatar";
import RiderLink from "./RiderLink";

export default function MemberRoster() {
  const { member } = useAuth();
  const { data } = useClubData();
  const { t } = useTranslation();

  return (
    <section className="content-section content-section--split" id="join">
      <div className="section-heading">
        <p className="section-kicker">{t("home.rosterKicker")}</p>
        <h2>{t("home.rosterTitle")}</h2>
        <p>{t("home.rosterBody")}</p>
      </div>

      <div className="section-body section-body--split">
        <div className="editor editor--warm roster-welcome">
          {member ? (
            <>
              <h3>{t("home.rosterWelcomeTitle", { name: member.name })}</h3>
              <p>{t("home.rosterWelcomeBody")}</p>
            </>
          ) : (
            <>
              <h3>{t("home.rosterJoinTitle")}</h3>
              <p>{t("home.rosterJoinBody")}</p>
              <div className="locked-note__actions">
                <Link className="button button--primary" to="/signup">
                  {t("common.createAccount")}
                </Link>
                <Link className="button button--outline" to="/login">
                  {t("common.logIn")}
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
                  {rider.neighborhood} · {t(`pace.${rider.pace}`) || toTitleCase(rider.pace)}
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
