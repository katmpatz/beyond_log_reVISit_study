import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

const LogChart = ({ parameters, answers }) => {
  const chartContainer = useRef(null);

  // derive current trial
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

  // when current trial changes, update state
  useEffect(() => {
    if (!current) return;
    setData(Array.isArray(current.data) ? current.data : []);
    setSelectedCategory1(current.selectedCategory1 ?? "");
    setSelectedCategory2(current.selectedCategory2 ?? "");
  }, [current]);

  // draw/update whenever inputs change
  useEffect(() => {
    if (!Array.isArray(data) || data.length === 0) return;
    if (!chartContainer.current) return;
    updateChart(data, selectedCategory1, selectedCategory2);
  }, [data, selectedCategory1, selectedCategory2]);

  //  layout
  const width = 800;
  const height = 600;
  const marginLeft = 60;
  const marginRight = 60;
  const marginTop = 40;
  const marginBottom = 60;

  const selectedColor = "#F85741";
  const evenBackgroundColor = "#ffffff";
  const oddBackgroundColor = "#f0f0f0";

  // helper to format log ticks
  const formatWithUnit = (value) => {
    const v = Number(value);
    if (!Number.isFinite(v)) return "";
    if (v >= 1_000_000_000 && v < 1_000_000_000_000)
      return `${parseInt(v / 1_000_000_000, 10)}B`;
    if (v >= 1_000_000 && v < 1_000_000_000)
      return `${parseInt(v / 1_000_000, 10)}M`;
    if (v >= 1_000 && v < 1_000_000)
      return `${parseInt(v / 1_000, 10)}k`;
    return String(v);
  };

  function updateChart(chartData, sel1, sel2) {
    // numeric safety – strip commas etc.
    const numericValues = chartData.map((d) =>
      +String(d.Value).replace(/,/g, "")
    );
    const maxVal = d3.max(numericValues);
    const minVal = d3.min(numericValues);

    if (!Number.isFinite(maxVal) || maxVal <= 0 || !Number.isFinite(minVal)) {
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

    // ticks
    const logTicks = [];
    for (let exp = 0; exp <= maxExponent; exp++) {
      for (let m = 1; m < 10; m++) {
        logTicks.push(m * 10 ** exp);
      }
    }

    const strongTicks = [];
    for (let exp = 0; exp <= maxExponent + 1; exp++) {
      strongTicks.push(1 * 10 ** exp);
    }

    const lightTicks = [];
    for (let exp = 0; exp <= maxExponent; exp++) {
      lightTicks.push(5 * 10 ** exp);
    }

    const horizontalLines = [];
    for (let exp = 0; exp <= maxExponent; exp++) {
      horizontalLines.push(5 * 10 ** exp);
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
      .scaleLog()
      .domain([1, 10 ** (maxExponent + 1)])
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
        .attr("y", y(10 ** (exp + 1)))
        .attr("width", width - marginLeft - marginRight)
        .attr("height", y(10 ** exp) - y(10 ** (exp + 1)))
        .attr("fill", exp % 2 === 0 ? evenBackgroundColor : oddBackgroundColor);
    }

    // grid strong
    svg
      .append("g")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(
        d3
          .axisLeft(y)
          .tickValues(strongTicks)
          .tickSize(-width + marginLeft + marginRight)
          .tickFormat("")
      )
      .call((g) => {
        g.select(".domain").remove();
        g.selectAll(".tick line")
          .attr("stroke", "#18182B")
          .attr("stroke-width", 1);
      });

    // grid thin
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

    // x-axis
    const xAxis = svg
      .append("g")
      .attr("transform", `translate(0,${height - marginBottom})`)
      .call(d3.axisBottom(x).tickSizeOuter(0));

    xAxis
      .selectAll(".tick text")
      .style("font-size", "1.2rem")
      .style("font-weight", "bold")
      .style("fill", (d) =>
        categoriesToHighlight.includes(d) ? selectedColor : "#000"
      );

    // left strong ticks
    svg
      .append("g")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(
        d3
          .axisLeft(y)
          .tickValues(strongTicks)
          .tickFormat((d) => formatWithUnit(d))
          .tickSize(4)
      )
      .call((g) => {
        g.selectAll(".tick text")
          .style("font-size", "1rem")
          .style("font-weight", "bold")
          .style("fill", "#000");
        g.select(".domain").remove();
      });

    // left light ticks
    svg
      .append("g")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(
        d3
          .axisLeft(y)
          .tickValues(lightTicks)
          .tickFormat((d) => formatWithUnit(d))
          .tickSize(4)
      )
      .call((g) => {
        g.selectAll(".tick text")
          .style("font-size", "1rem")
          .style("fill", "#8E8F96");
        g.select(".domain").remove();
      });

    // left small ticks
    svg
      .append("g")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(d3.axisLeft(y).tickValues(logTicks).tickFormat("").tickSize(4))
      .call((g) => g.select(".domain").remove());

    // right strong ticks
    svg
      .append("g")
      .attr("transform", `translate(${width - marginRight},0)`)
      .call(
        d3
          .axisRight(y)
          .tickValues(strongTicks)
          .tickFormat((d) => formatWithUnit(d))
          .tickSize(4)
      )
      .call((g) => {
        g.selectAll(".tick text")
          .style("font-size", "1rem")
          .style("font-weight", "bold")
          .style("fill", "#000");
        g.select(".domain").remove();
      });

    // right light ticks
    svg
      .append("g")
      .attr("transform", `translate(${width - marginRight},0)`)
      .call(
        d3
          .axisRight(y)
          .tickValues(lightTicks)
          .tickFormat((d) => formatWithUnit(d))
          .tickSize(4)
      )
      .call((g) => {
        g.selectAll(".tick text")
          .style("font-size", "1rem")
          .style("fill", "#8E8F96");
        g.select(".domain").remove();
      });

    // right small ticks
    svg
      .append("g")
      .attr("transform", `translate(${width - marginRight},0)`)
      .call(d3.axisRight(y).tickValues(logTicks).tickFormat("").tickSize(4))
      .call((g) => g.select(".domain").remove());

    // bars
    svg
      .append("g")
      .attr("fill", "#14164C")
      .selectAll("rect")
      .data(chartData, (d) => d.Category)
      .join("rect")
      .attr("x", (d) => x(d.Category))
      .attr("y", (d) =>
        y(+String(d.Value).replace(/,/g, ""))
      )
      .attr("height", (d) => y(1) - y(+String(d.Value).replace(/,/g, "")))
      .attr("width", x.bandwidth());

    // y label
    svg
      .append("text")
      .attr("x", marginLeft)
      .attr("y", marginTop - 15)
      .attr("text-anchor", "end")
      .text("Value")
      .attr("font-size", "1.2rem")
      .attr("fill", "#000");

    // units legend
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

    // highlight boxes around selected categories
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

export default LogChart;
