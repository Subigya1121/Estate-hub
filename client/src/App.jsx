import { Route, Routes, useParams } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import { LISTING_PAGES } from "./data/listingPages.js";
import { RequireAuth, RequireReviewer } from "./components/RouteGuards.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import ListProperty from "./pages/ListProperty.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ReviewQueue from "./pages/ReviewQueue.jsx";
import About from "./pages/About.jsx";
import Contact from "./pages/Contact.jsx";
import Inbox from "./pages/Inbox.jsx";
import Favorites from "./pages/Favorites.jsx";
import ListingPage from "./pages/ListingPage.jsx";
import PropertyDetails from "./pages/PropertyDetails.jsx";
import ComingSoon from "./pages/ComingSoon.jsx";
import NotFound from "./pages/NotFound.jsx";

// Remount the detail page per property so loading/tab state resets
function PropertyRoute() {
  const { id } = useParams();
  return <PropertyDetails key={id} />;
}

const listing = (scope) => <ListingPage key={scope.key} scope={scope} />;

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="buy" element={listing(LISTING_PAGES.buy)} />
        <Route path="rent" element={listing(LISTING_PAGES.rent)} />
        <Route path="land" element={listing(LISTING_PAGES.land)} />
        <Route path="commercial" element={listing(LISTING_PAGES.commercial)} />
        <Route path="properties" element={listing(LISTING_PAGES.all)} />
        <Route path="properties/:id" element={<PropertyRoute />} />
        <Route path="favorites" element={<Favorites />} />
        <Route path="about" element={<About />} />
        <Route path="contact" element={<Contact />} />
        <Route path="login" element={<Login />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route element={<RequireAuth />}>
          <Route path="list-property" element={<ListProperty mode="new" />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="dashboard/inquiries" element={<Inbox />} />
          <Route path="dashboard/listings/:id/edit" element={<ListProperty mode="edit" />} />
        </Route>
        <Route element={<RequireReviewer />}>
          <Route path="review" element={<ReviewQueue />} />
        </Route>
        <Route path="privacy" element={<ComingSoon title="Privacy" />} />
        <Route path="terms" element={<ComingSoon title="Terms" />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
