import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import MetricBand from "../components/MetricBand";
import ProfileEditForm from "../components/ProfileEditForm";
import RiderAvatar from "../components/RiderAvatar";
import RouteCard from "../components/RouteCard";
import TopBar from "../components/TopBar";
import { useAuth } from "../context/AuthContext";
import { useClubData } from "../context/ClubDataContext";
import { useTranslation } from "../i18n";
import { formatDate, formatMiles, toTitleCase } from "../utils";

export default function RiderProfilePage() {
  const { id } = useParams();
  const { member, updateMember } = useAuth();
  const { data, loading, loadBootstrap } = useClubData();
  const { t, lang } = useTranslation();
  const [editing, setEditing] = useState(false);

  const rider = data?.members.find((item) => item.id === id);
  const isOwnProfile = member?.id === rider?.id;

  const computed = useMemo(() => {
    if (!data || !rider) {
      return null;
    }

    const favoriteSource = isOwnProfile ? member : rider;
    const favoriteRouteIds = favoriteSource?.favoriteRouteIds ?? [];
    const metrics = data.metricsByRider?.[rider.id];
    const riderRoutes = data.routes.filter((route) => route.createdById === rider.id);
    const riderPhotos = data.photos.filter((photo) => photo.createdById === rider.id);
    const riderPosts = data.posts.filter((post) => post.createdById === rider.id);
    const riderGroups = data.groups.filter((group) => group.memberIds.includes(rider.id));
    const favoriteRoutes = favoriteRouteIds
      .map((routeId) => data.routes.find((route) => route.id === routeId))
      .filter(Boolean);

    const buddyMap = new Map();
    for (const group of riderGroups) {
      for (const otherId of group.memberIds) {
        if (otherId === rider.id) continue;
        const existing = buddyMap.get(otherId) ?? { sharedGroups: 0, groupNames: [] };
        existing.sharedGroups += 1;
        existing.groupNames.push(group.name);
        buddyMap.set(otherId, existing);
      }
    }
    const buddies = [...buddyMap.entries()]
      .map(([buddyId, meta]) => ({
        rider: data.members.find((m) => m.id === buddyId),
        ...meta
      }))
      .filter((entry) => entry.rider)
      .sort((a, b) => b.sharedGroups - a.sharedGroups)
      .slice(0, 8);

    const activity = [
      ...riderRoutes.map((r) => ({
        type: "route",
        at: r.createdAt,
        title: r.title,
        meta: `${formatMiles(r.distanceMiles)} · ${r.terrain}`,
        href: `/routes/${r.id}/ride`
      })),
      ...riderPhotos.map((p) => ({
        type: "photo",
        at: p.createdAt,
        title: p.caption || "Ride photo",
        meta: p.routeTag,
        href: null
      })),
      ...riderPosts.map((p) => ({
        type: "post",
        at: p.createdAt,
        title: p.title,
        meta: t("profile.activityPost"),
        href: null
      }))
    ]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 8);

    return {
      metrics,
      riderRoutes,
      riderPhotos,
      riderPosts,
      riderGroups,
      favoriteRoutes,
      buddies,
      activity
    };
  }, [data, rider, member, isOwnProfile, t]);

  if (loading || !data) {
    return (
      <div className="loading-state">
        <p className="loading-kicker">Xxica</p>
        <h1>{t("profile.loading")}</h1>
      </div>
    );
  }

  if (!rider || !computed) {
    return (
      <div className="app-shell">
        <TopBar minimal />
        <div className="loading-state loading-state--error">
          <p className="loading-kicker">Xxica</p>
          <h1>{t("profile.notFound")}</h1>
          <Link className="button button--primary" to="/">
            {t("profile.backToBoard")}
          </Link>
        </div>
      </div>
    );
  }

  const { metrics, riderRoutes, riderPhotos, riderPosts, riderGroups, favoriteRoutes, buddies, activity } =
    computed;
  const firstName = rider.name.split(" ")[0];
  const memberSince = rider.createdAt ? formatJoinDate(rider.createdAt, lang) : null;
  const milesTier = getMilesTier(metrics?.milesBiked ?? 0, t);

  async function handleSaved(updated) {
    updateMember(updated);
    await loadBootstrap();
    setEditing(false);
  }

  const sectionHeading = (ownKey, otherKey) =>
    isOwnProfile ? t(ownKey) : t(otherKey, { name: firstName });

  const buddyShared = (count) =>
    count === 1
      ? t("profile.buddySharedSingle", { count })
      : t("profile.buddySharedPlural", { count });

  return (
    <div className="app-shell">
      <TopBar minimal />

      <section className="content-section profile-hero">
        <div className="profile-hero__top">
          <div className="profile-hero__id">
            <RiderAvatar className="profile-avatar profile-avatar--lg" rider={rider} />
            <div className="profile-hero__id-text">
              <p className="section-kicker">{t("profile.kicker")}</p>
              <h1>{rider.name}</h1>
              <p className="profile-meta">
                {rider.neighborhood} · {t(`pace.${rider.pace}`) || toTitleCase(rider.pace)}
                {rider.bike ? ` · ${rider.bike}` : ""}
              </p>
            </div>
          </div>

          {isOwnProfile && !editing ? (
            <button
              className="button button--outline"
              type="button"
              onClick={() => setEditing(true)}
            >
              {t("profile.editProfile")}
            </button>
          ) : null}
        </div>

        <div className="profile-badges">
          {memberSince ? (
            <span className="profile-badge profile-badge--cool">
              <span className="profile-badge__dot" />
              {t("profile.badgeMemberSince", { date: memberSince })}
            </span>
          ) : null}
          {milesTier ? (
            <span className={`profile-badge profile-badge--${milesTier.tone}`}>
              <span className="profile-badge__dot" />
              {milesTier.label}
            </span>
          ) : null}
          {riderGroups.length ? (
            <span className="profile-badge profile-badge--warm">
              <span className="profile-badge__dot" />
              {riderGroups.length === 1
                ? t("profile.badgeGroupSingle", { count: riderGroups.length })
                : t("profile.badgeGroupPlural", { count: riderGroups.length })}
            </span>
          ) : null}
          {metrics?.ridesTaken ? (
            <span className="profile-badge profile-badge--red">
              <span className="profile-badge__dot" />
              {metrics.ridesTaken === 1
                ? t("profile.badgeRideSingle", { count: metrics.ridesTaken })
                : t("profile.badgeRidePlural", { count: metrics.ridesTaken })}
            </span>
          ) : null}
        </div>

        {rider.bio ? <p className="profile-bio">{rider.bio}</p> : null}

        {isOwnProfile && editing ? (
          <ProfileEditForm
            member={member}
            onSaved={handleSaved}
            onCancel={() => setEditing(false)}
          />
        ) : null}
      </section>

      <MetricBand metrics={metrics} />

      <main className="workspace">
        <section className="content-section profile-section profile-section--cool">
          <div className="section-heading">
            <p className="section-kicker">{t("profile.sectionGroupsKicker")}</p>
            <h2>{sectionHeading("profile.sectionGroupsOwn", "profile.sectionGroupsOther")}</h2>
          </div>
          {riderGroups.length ? (
            <div className="group-inline-list">
              {riderGroups.map((group) => (
                <Link className="group-inline-link" key={group.id} to={`/groups/${group.id}`}>
                  {group.name}
                </Link>
              ))}
            </div>
          ) : (
            <p className="empty-note">{t("profile.sectionGroupsEmpty")}</p>
          )}
        </section>

        <section className="content-section profile-section profile-section--red">
          <div className="section-heading">
            <p className="section-kicker">{t("profile.sectionBuddiesKicker")}</p>
            <h2>{sectionHeading("profile.sectionBuddiesOwn", "profile.sectionBuddiesOther")}</h2>
          </div>
          {buddies.length ? (
            <div className="buddy-grid">
              {buddies.map(({ rider: buddy, sharedGroups, groupNames }) => (
                <Link className="buddy-card" key={buddy.id} to={`/riders/${buddy.id}`}>
                  <RiderAvatar className="buddy-card__avatar" rider={buddy} />
                  <div className="buddy-card__body">
                    <h3>{buddy.name}</h3>
                    <p>
                      {buddyShared(sharedGroups)} · {groupNames.slice(0, 2).join(", ")}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="empty-note">{t("profile.sectionBuddiesEmpty")}</p>
          )}
        </section>

        <section className="content-section profile-section profile-section--deep">
          <div className="section-heading">
            <p className="section-kicker">{t("profile.sectionActivityKicker")}</p>
            <h2>{sectionHeading("profile.sectionActivityOwn", "profile.sectionActivityOther")}</h2>
          </div>
          {activity.length ? (
            <ol className="activity-feed">
              {activity.map((item) => (
                <li
                  className={`activity-item activity-item--${item.type}`}
                  key={`${item.type}-${item.title}-${item.at}`}
                >
                  <span className="activity-item__icon" aria-hidden="true">
                    {ACTIVITY_ICONS[item.type]}
                  </span>
                  <div className="activity-item__body">
                    <p className="activity-item__title">
                      {item.href ? <Link to={item.href}>{item.title}</Link> : item.title}
                    </p>
                    <p className="activity-item__meta">
                      <span className="activity-item__type">
                        {t(`profile.activity${capitalize(item.type)}`)}
                      </span>
                      <span>·</span>
                      <span>{item.meta}</span>
                      <span>·</span>
                      <span>{formatDate(item.at, lang)}</span>
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="empty-note">{t("profile.sectionActivityEmpty")}</p>
          )}
        </section>

        <section className="content-section profile-section profile-section--red">
          <div className="section-heading">
            <p className="section-kicker">{t("profile.sectionFavoritesKicker")}</p>
            <h2>{sectionHeading("profile.sectionFavoritesOwn", "profile.sectionFavoritesOther")}</h2>
          </div>
          {favoriteRoutes.length ? (
            <div className="stack-list">
              {favoriteRoutes.map((route) => (
                <RouteCard key={route.id} route={route} />
              ))}
            </div>
          ) : (
            <p className="empty-note">{t("profile.sectionFavoritesEmpty")}</p>
          )}
        </section>

        <section className="content-section profile-section profile-section--deep">
          <div className="section-heading">
            <p className="section-kicker">{t("profile.sectionRoutesKicker")}</p>
            <h2>{sectionHeading("profile.sectionRoutesOwn", "profile.sectionRoutesOther")}</h2>
          </div>
          {riderRoutes.length ? (
            <div className="stack-list">
              {riderRoutes.map((route) => (
                <RouteCard key={route.id} route={route} />
              ))}
            </div>
          ) : (
            <p className="empty-note">{t("profile.sectionRoutesEmpty")}</p>
          )}
        </section>

        <section className="content-section content-section--gallery">
          <div className="section-heading">
            <p className="section-kicker">{t("profile.sectionPhotosKicker")}</p>
            <h2>{sectionHeading("profile.sectionPhotosOwn", "profile.sectionPhotosOther")}</h2>
          </div>
          {riderPhotos.length ? (
            <div className="photo-grid">
              {riderPhotos.map((photo, index) => (
                <article className="photo-tile" key={photo.id}>
                  {photo.imageUrl ? (
                    <img alt={photo.caption} src={photo.imageUrl} />
                  ) : (
                    <div className={`photo-placeholder tone-${index % 4}`}>
                      <span>{photo.routeTag}</span>
                    </div>
                  )}
                  <div className="photo-copy">
                    <p>{photo.caption}</p>
                    <footer>
                      <span>{photo.routeTag}</span>
                    </footer>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-note">{t("profile.sectionPhotosEmpty")}</p>
          )}
        </section>

        <section className="content-section profile-section profile-section--warm">
          <div className="section-heading">
            <p className="section-kicker">{t("profile.sectionJournalKicker")}</p>
            <h2>{sectionHeading("profile.sectionJournalOwn", "profile.sectionJournalOther")}</h2>
          </div>
          {riderPosts.length ? (
            <div className="stack-list stack-list--journal">
              {riderPosts.map((post) => (
                <article className="journal-entry" key={post.id}>
                  <p className="journal-entry__meta">{formatDate(post.createdAt, lang)}</p>
                  <h3>{post.title}</h3>
                  <p>{post.body}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-note">{t("profile.sectionJournalEmpty")}</p>
          )}
        </section>
      </main>
    </div>
  );
}

const ACTIVITY_ICONS = {
  route: "↗",
  photo: "▢",
  post: "✎"
};

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatJoinDate(value, lang) {
  try {
    return new Intl.DateTimeFormat(lang === "es" ? "es-MX" : "en-US", {
      month: "short",
      year: "numeric"
    }).format(new Date(value));
  } catch {
    return null;
  }
}

function getMilesTier(miles, t) {
  if (miles >= 250) {
    return { label: t("profile.badgeMilesVeterano", { miles: formatMiles(miles) }), tone: "red" };
  }
  if (miles >= 100) {
    return { label: t("profile.badgeMilesCenturion", { miles: formatMiles(miles) }), tone: "warm" };
  }
  if (miles >= 25) {
    return { label: t("profile.badgeMilesRegular", { miles: formatMiles(miles) }), tone: "cool" };
  }
  if (miles > 0) {
    return { label: t("profile.badgeMilesRolling", { miles: formatMiles(miles) }), tone: "cool" };
  }
  return null;
}
