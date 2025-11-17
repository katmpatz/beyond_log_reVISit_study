import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

const round = (number) => {
    const fractionalPart = number % 1; // Get the fractional part of the number
  
    if (fractionalPart > 0.5) {
      return Math.ceil(number); // Round up
    } else {
      return Math.floor(number); // Round down
    }
  }

const Bricks = ({ parameters, answers }) => {
  const chartContainer = useRef(null);

  //derive current trial
  const current = useMemo(() => {
    const ds = parameters?.dataset?.dataSetup;
    const idx = parameters?.currentTrial ?? -1;

    if (!Array.isArray(ds) || idx < 0 || idx >= ds.length) return null;
    return ds[idx];
  }, [parameters?.dataset?.dataSetup, parameters?.currentTrial]);

  // local state sourced from current
  const [data, setData] = useState(() => current?.data ?? []);
  const [selectedCategory1, setSelectedCategory1] = useState(
    () => current?.selectedCategory1 ?? ""
  );
  const [selectedCategory2, setSelectedCategory2] = useState(
    () => current?.selectedCategory2 ?? ""
  );

  useEffect(() => {
    if (!current) return;
    setData(Array.isArray(current.data) ? current.data : []);
    setSelectedCategory1(current.selectedCategory1 ?? "");
    setSelectedCategory2(current.selectedCategory2 ?? "");
  }, [current]);

  // layout
  const width = 800;
  const height = 600;
  const marginLeft = 60;
  const marginRight = 60;
  const marginTop = 40;
  const marginBottom = 60;

  const selectedColor = "#F85741";
  const evenBackgroundColor = "#ffffff";
  const oddBackgroundColor = "#f0f0f0";
  const barColor = "#14164C";
  const missingUnitColor = "rgb(200, 200, 211)";
  const numberOfTicksInFacet = 9;

  // eplusm
  const scaleExpPlusMant = (v, base) => {
    const exp = Math.trunc(v);
    const mant = (base / (base - 1)) * (v - exp);
    const scale = mant !== 0 ? mant * base ** (exp + 1) : base ** exp;
    const value = Math.round(scale * 100) / 100;

    if (value >= 1_000_000_000 && value < 1_000_000_000_000)
      return `${parseInt(value / 1_000_000_000, 10)}B`;
    if (value >= 1_000_000 && value < 1_000_000_000)
      return `${parseInt(value / 1_000_000, 10)}M`;
    if (value >= 1_000 && value < 1_000_000)
      return `${parseInt(value / 1_000, 10)}k`;
    return String(value);
  };

  const getExponent = (value, base) => {
    const v = Number(value);
    if (!Number.isFinite(v) || v <= 0) return 0;
    const baseLog = Math.log(v) / Math.log(base);
    return Math.trunc(baseLog);
  };

  const getMantissa = (value, base) => {
    const v = Number(value);
    if (!Number.isFinite(v) || v <= 0) return 1;
    const baseLog = Math.log(v) / Math.log(base);
    return v / base ** Math.floor(baseLog);
  };

  const getExponentPlusMantissa = (value, base) => {
    const exp = getExponent(value, base);
    const mant = getMantissa(value, base);
    return exp + (mant - 1) / (base - 1);
  };

  //draw / update
  useEffect(() => {
    if (!Array.isArray(data) || data.length === 0) return;
    if (!chartContainer.current) return;
    updateChart(data, selectedCategory1, selectedCategory2);
  }, [data, selectedCategory1, selectedCategory2]);

  function updateChart(chartData, sel1, sel2) {
    const numericValues = chartData.map((d) =>
      +String(d.Value).replace(/,/g, "")
    );
    const maxVal = d3.max(numericValues);

    if (!Number.isFinite(maxVal) || maxVal <= 0) {
      const svgSmoke = d3
        .select(chartContainer.current)
        .attr("width", width)
        .attr("height", height);
      svgSmoke.selectAll("*").remove();
      svgSmoke
        .append("rect")
        .attr("x", 10)
        .attr("y", 10)
        .attr("width", 80)
        .attr("height", 40)
        .attr("fill", "red");
      return;
    }

    const maxExponent = Math.floor(Math.log10(maxVal));
    const minExponent = 0;

    // eplusm mid ticks + horizontal lines
    const eplusmTickValues = [];
    const horizontalLines = [];
    for (let i = 0; i <= maxExponent; i++) {
      const v = i + 0.44999999999999;
      horizontalLines.push(v);
      eplusmTickValues.push(v);
    }

    const expTicks = [];
    for (let exp = 0; exp <= maxExponent + 1; exp++) {
      expTicks.push(exp);
    }

    const allTicks = [];
    for (let exp = 0; exp <= maxExponent; exp++) {
      for (let m = 1; m < 10; m++) {
        allTicks.push(exp + (m - 1) / (10 - 1));
      }
    }

    const facetHeight =
      (height - marginTop - marginBottom) / (maxExponent - minExponent + 1);
    const unitSpace = facetHeight / numberOfTicksInFacet;
    const spaceBetweenUnits = 3;
    let unitHeight;
    if (unitSpace <= 2) {
      unitHeight = 0;
      // console.warn("Not sufficient size to display bricks");
    } else {
      unitHeight = unitSpace - spaceBetweenUnits;
    }

    const categoriesToHighlight = [sel1, sel2].filter(Boolean);

    // scales
    const x = d3
      .scaleBand()
      .domain(
        [...chartData]
          .sort((a, b) => d3.ascending(a.Category, b.Category))
          .map((d) => d.Category)
      )
      .range([marginLeft, width - marginRight])
      .padding(0.4);

    const y = d3
      .scaleLinear()
      .domain([0, maxExponent + 1])
      .range([height - marginBottom, marginTop]);

    const svg = d3
      .select(chartContainer.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", null);

    svg.selectAll("*").remove();

    // background bands
    for (let exp = 0; exp <= maxExponent; exp++) {
      svg
        .append("rect")
        .attr("x", marginLeft)
        .attr("y", y(exp + 1))
        .attr("width", width - marginLeft - marginRight)
        .attr("height", y(exp) - y(exp + 1))
        .attr("fill", exp % 2 === 0 ? evenBackgroundColor : oddBackgroundColor);
    }

    // thin grid
    svg
      .append("g")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(
        d3
          .axisLeft(y)
          .tickValues(horizontalLines)
          .tickSize(-width + marginLeft + marginRight)
          .tickFormat("")
      )
      .call((g) => {
        g.select(".domain").remove();
        g.selectAll(".tick line")
          .attr("stroke", "#18182B")
          .attr("stroke-opacity", 0.5)
          .attr("stroke-width", 0.5);
      });

    // thick grid
    svg
      .append("g")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(
        d3
          .axisLeft(y)
          .tickValues(expTicks)
          .tickSize(-width + marginLeft + marginRight)
          .tickFormat("")
      )
      .call((g) => {
        g.select(".domain").remove();
        g.selectAll(".tick line")
          .attr("stroke", "#18182B")
          .attr("stroke-width", 1);
      });

    // base bar (full height per exponent)
    svg
      .append("g")
      .attr("fill", barColor)
      .selectAll("rect")
      .data(chartData, (d) => d.Category)
      .join("rect")
      .attr("x", (d) => x(d.Category))
      .attr("y", (d) => {
        const v = +String(d.Value).replace(/,/g, "");
        return y(getExponent(v, 10)) + unitHeight;
      })
      .attr("height", (d) => {
        const v = +String(d.Value).replace(/,/g, "");
        return y(0) - y(getExponent(v, 10)) - unitHeight;
      })
      .attr("width", x.bandwidth());

    // helper to create vertical bricks for one bar
    function createUnits(numberOfDataPoints, xPos, yPos, color) {
      const dataArr = new Array(numberOfDataPoints).fill(0);
      const columns = 1;

      const waffleChartGroup = svg
        .append("g")
        .attr("transform", `translate(${xPos}, 0)`);

      waffleChartGroup
        .selectAll("rect")
        .data(dataArr)
        .enter()
        .append("rect")
        .attr("width", x.bandwidth())
        .attr("height", unitHeight)
        .attr("x", (d, i) => (i % columns) * unitHeight)
        .attr("y", (d, i) =>
          unitHeight +
          yPos -
          (i + 1) * (unitHeight + spaceBetweenUnits) +
          spaceBetweenUnits / 2
        )
        .attr("fill", color);
    }

    // background "missing" bricks (10 total)
    chartData.forEach((d) => {
      const v = +String(d.Value).replace(/,/g, "");
      const expPos = getExponent(v, 10);
      const xPos = x(d.Category);
      if (xPos == null) return;

      const totalUnits = 10;
      createUnits(totalUnits, xPos, y(expPos), missingUnitColor);
    });

    // filled bricks for mantissa
    chartData.forEach((d) => {
      const v = +String(d.Value).replace(/,/g, "");
      const expPos = getExponent(v, 10);
      let numUnits = round(getMantissa(v, 10));

      if (numUnits > 10) numUnits = 10;
      const xPos = x(d.Category);
      if (xPos == null) return;

      createUnits(numUnits, xPos, y(expPos), barColor);
    });

    // x-axis
    const xAxis = svg
      .append("g")
      .attr("transform", `translate(0,${height - marginBottom})`)
      .call(d3.axisBottom(x).tickSizeOuter(0));

    xAxis
      .selectAll(".tick text")
      .style("font-size", "1.2rem")
      .style("fill", (d) =>
        categoriesToHighlight.includes(d) ? selectedColor : "#000"
      )
      .style("font-weight", (d) =>
        categoriesToHighlight.includes(d) ? "bold" : "normal"
      );

    // left strong ticks
    svg
      .append("g")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(
        d3
          .axisLeft(y)
          .tickValues(expTicks)
          .tickFormat((d) => scaleExpPlusMant(d, 10))
          .tickSize(4)
      )
      .call((g) => {
        g.selectAll(".tick text")
          .style("font-size", "1rem")
          .style("font-weight", "bold")
          .style("fill", "#000");
      });

    // left light ticks
    svg
      .append("g")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(
        d3
          .axisLeft(y)
          .tickValues(eplusmTickValues)
          .tickFormat((d) => scaleExpPlusMant(d, 10))
          .tickSize(4)
      )
      .call((g) => {
        g.select(".domain").remove();
        g.selectAll(".tick text")
          .style("font-size", "1rem")
          .style("fill", "#8E8F96");
      });

    // left small ticks
    svg
      .append("g")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(d3.axisLeft(y).tickValues(allTicks).tickFormat("").tickSize(4))
      .call((g) => g.select(".domain").remove());

    // right strong ticks
    svg
      .append("g")
      .attr("transform", `translate(${width - marginRight},0)`)
      .call(
        d3
          .axisRight(y)
          .tickValues(expTicks)
          .tickFormat((d) => scaleExpPlusMant(d, 10))
          .tickSize(4)
      )
      .call((g) => {
        g.selectAll(".tick text")
          .style("font-size", "1rem")
          .style("font-weight", "bold")
          .style("fill", "#000");
      });

    // right light ticks
    svg
      .append("g")
      .attr("transform", `translate(${width - marginRight},0)`)
      .call(
        d3
          .axisRight(y)
          .tickValues(eplusmTickValues)
          .tickFormat((d) => scaleExpPlusMant(d, 10))
          .tickSize(4)
      )
      .call((g) => {
        g.select(".domain").remove();
        g.selectAll(".tick text")
          .style("font-size", "1rem")
          .style("fill", "#8E8F96");
      });

    // right small ticks
    svg
      .append("g")
      .attr("transform", `translate(${width - marginRight},0)`)
      .call(d3.axisRight(y).tickValues(allTicks).tickFormat("").tickSize(4))
      .call((g) => g.select(".domain").remove());

    // y label
    svg
      .append("text")
      .attr("x", marginLeft)
      .attr("y", marginTop - 15)
      .attr("text-anchor", "end")
      .text("Value")
      .attr("font-size", "1.2rem")
      .attr("fill", "#000");

    // unit legend
    svg
      .append("text")
      .attr("x", marginLeft)
      .attr("y", height - 5)
      .attr("text-anchor", "start")
      .text(
        "k = Thousand (1,000),  M = Million (1,000,000),  B = Billion (1,000,000,000)"
      )
      .attr("alignment-baseline", "start")
      .attr("font-size", "1.2rem")
      .attr("fill", "#000");

    // highlight boxes for selected categories
    categoriesToHighlight.forEach((cat) => {
      const xPos = x(cat);
      if (xPos == null) return;
      const xSpace = 10;
      const yTop = marginTop - 10;
      const yBottom = height - 25;

      svg
        .append("rect")
        .attr("fill", "transparent")
        .attr("stroke", selectedColor)
        .attr("stroke-width", 3)
        .attr("x", xPos - xSpace)
        .attr("y", yTop)
        .attr("height", yBottom - yTop)
        .attr("width", x.bandwidth() + xSpace * 2);
    });
  }

  return <svg ref={chartContainer} width={800} height={500} />;
};

export default Bricks;
