import React, { useState, useEffect } from "react";
import Snowfall from "react-snowfall";

import "/src/components/css/Home.css";
import SectionOne from "../../components/Home/SectionOne";
import SectionTwo from "../../components/Home/SectionTwo";
import SectionThree from "../../components/Home/SectionThree";
import Footer from "../../components/globals/Footer";
import { MetaData } from "../../components/CustomComponents";
import ScrollToTop from "../../components/globals/ScrollToTop";

export default function Homepage() {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;

  const shouldShowSnowfall = currentMonth >= 10 || currentMonth <= 3;

  return (
    <>
      <MetaData path="home" />
      <div>
        <div id="home" className="antialiased">
          {shouldShowSnowfall && (
            <Snowfall
              snowflakeCount={50}
              speed={[0.2, 0.5]}
              wind={[-0.2, 0]}
              style={{ position: "fixed", zIndex: -1 }}
            />
          )}

          <SectionOne />
          <SectionTwo />
          <SectionThree />
          <ScrollToTop toid={"home"} h={2} />
        </div>
      </div>
    </>
  );
}
