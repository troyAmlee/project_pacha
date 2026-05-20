import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import MetricBand from "../components/MetricBand";
import ProfileEditForm from "../components/ProfileEditForm";
import RiderAvatar from "../components/RiderAvatar";
import RouteCard from "../components/RouteCard";
import TopBar from "../components/TopBar";
import { useAuth } from "../context/AuthContext";
import { useClubData } from "../context/ClubDataContext";
import { formatDate, toTitleCase } from "../utils";

export default function RiderProfilePage() {
  const { id } = useParams();
  const { member, updateMember } = useAuth();
  const { data, loading, loadBootstrap } = useClubData();
  const [editing, setEditing] = useState(false);

  if (loading || !data) {
    return (
      <div className="loading-state">
        <p className="loading-kicker">North Star Ridebook</p>
        <h1>Loading rider profile...</h1>
      </div>
    );
  }

  const rider = data.members.find((item) => item.id === id);

  if (!rider) {
    return (
      <div className="app-shell">
        <TopBar minimal />
        <div className="loading-state loading-state--error">
          <p className="loading-kicker">North Star Ridebook</p>
          <h1>That rider is not on the roster.</h1>
          <Link className="button button--primary" to="/">
            Back to the ride board
          </Link>
        </div>
      </div>
    );
  }

  const isOwnProfile = member?.id === rider.id;
  const favoriteSource = isOwnProfile ? member : rider;
  const favoriteRouteIds = favoriteSource.favoriteRouteIds ?? [];

  const metrics = data.metricsByRider?.[rider.id];
  const riderRoutes = data.routes.filter((route) => route.createdById === rider.id);
  const riderPhotos = data.photos.filter((photo) => photo.createdById === rider.id);
  const riderPosts = data.posts.filter((post) => post.createdById === rider.id);
  const riderGroups = data.groups.filter((group) => group.memberIds.includes(rider.id));
  const favoriteRoutes = favoriteRouteIds
    .map((routeId) => data.routes.find((route) => route.id === routeId))
    .filter(Boolean);

  const firstName = rider.name.split(" ")[0];
  const possessive = isOwnProfile ? "you" : firstName;

  async function handleSaved(updated) {
    updateMember(updated);
    await loadBootstrap();
    setEditing(false);
  }

  return (
    <div className="app-shell">
      <TopBar minimal />

      <section className="content-section profile-header">
        <div className="profile-id">
          <RiderAvatar className="profile-avatar" rider={rider} />
          <div>
            <p className="section-kicker">Rider profile</p>
            <h1>{rider.name}</h1>
            <p className="profile-meta">
              {rider.neighborhood} - {toTitleCase(rider.pace)} pace
              {rider.bike ? ` - ${rider.bike}` : ""}
            </p>
          </div>
        </div>

        <p className="profile-bio">{rider.bio}</p>

        {isOwnProfile && !editing ? (
          <button
            className="button button--outline"
            type="button"
            onClick={() => setEditing(true)}
          >
            Edit profile
          </button>
        ) : null}

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
        <section className="content-section">
          <div className="section-heading">
            <p className="section-kicker">Ride groups</p>
            <h2>Groups {possessive} ride with right now.</h2>
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
            <p className="empty-note">No group memberships yet.</p>
          )}
        </section>

        <section className="content-section">
          <div className="section-heading">
            <p className="section-kicker">Favorite routes</p>
            <h2>Loops {possessive} keep coming back to.</h2>
          </div>
          {favoriteRoutes.length ? (
            <div className="stack-list">
              {favoriteRoutes.map((route) => (
                <RouteCard key={route.id} route={route} />
              ))}
            </div>
          ) : (
            <p className="empty-note">No favorite routes pinned yet.</p>
          )}
        </section>

        <section className="content-section">
          <div className="section-heading">
            <p className="section-kicker">Routes shared</p>
            <h2>Routes {possessive} put on the board.</h2>
          </div>
          {riderRoutes.length ? (
            <div className="stack-list">
              {riderRoutes.map((route) => (
                <RouteCard key={route.id} route={route} />
              ))}
            </div>
          ) : (
            <p className="empty-note">No routes shared yet.</p>
          )}
        </section>

        <section className="content-section content-section--gallery">
          <div className="section-heading">
            <p className="section-kicker">Photo drops</p>
            <h2>Moments {possessive} posted from the saddle.</h2>
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
            <p className="empty-note">No ride photos posted yet.</p>
          )}
        </section>

        <section className="content-section">
          <div className="section-heading">
            <p className="section-kicker">Journal entries</p>
            <h2>Notes {possessive} added to the club journal.</h2>
          </div>
          {riderPosts.length ? (
            <div className="stack-list stack-list--journal">
              {riderPosts.map((post) => (
                <article className="journal-entry" key={post.id}>
                  <p className="journal-entry__meta">{formatDate(post.createdAt)}</p>
                  <h3>{post.title}</h3>
                  <p>{post.body}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-note">No journal entries written yet.</p>
          )}
        </section>
      </main>
    </div>
  );
}
