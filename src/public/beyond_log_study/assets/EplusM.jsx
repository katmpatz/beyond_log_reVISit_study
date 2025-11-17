import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

const EplusM = ({ parameters, answers }) => {
  const chartContainer = useRef(null);

  //derive current trial
  const current = useMemo(() => {
    console.log("parameters: ", parameters)
    const ds = parameters?.dataset?.dataSetup;
    console.log("ds: ", ds)
    const idx = parameters?.currentTrial ?? -1;
    console.log("idx: ", idx)
    if (!Array.isArray(ds) || idx < 0 || idx >= ds.length) return null;
    return ds[idx];
  }, [parameters?.dataset?.dataSetup, parameters?.currentTrial]);
  console.log("current: ",current)

  //local state sourced from current
  const [data, setData] = useState(() => current?.data ?? []);
  const [selectedCategory1, setSelectedCategory1] = useState(() => current?.selectedCategory1 ?? "");
  const [selectedCategory2, setSelectedCategory2] = useState(() => current?.selectedCategory2 ?? "");

  // when current trial changes, update state (do not draw here)
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

  // layout
  const width = 800, height = 600;
  const marginLeft = 60, marginRight = 60, marginTop = 40, marginBottom = 60;
  const GRID_STRONG = "#18182B";
  const TEXT_LIGHT  = "#8E8F96";
  const selectedColor = "#F85741";
  const evenBackgroundColor = "#ffffff";
  const oddBackgroundColor  = "#f0f0f0";

  const getExponent = (v, base) => Math.trunc(Math.log(v) / Math.log(base));
  const getMantissa = (v, base) => v / (base ** Math.floor(Math.log(v) / Math.log(base)));
  const getExponentPlusMantissa = (v, base) =>
    getExponent(v, base) + (getMantissa(v, base) - 1) / (base - 1);

  const scaleExpPlusMant = (t, base) => {
    const exp = Math.trunc(t);
    const mant = (base / (base - 1)) * (t - exp);
    const scale = mant !== 0 ? mant * base ** (exp + 1) : base ** exp;
    const val = Math.round(scale * 100) / 100;
    if (val >= 1_000_000_000 && val < 1_000_000_000_000) return `${parseInt(val / 1_000_000_000)}B`;
    if (val >= 1_000_000 && val < 1_000_000_000) return `${parseInt(val / 1_000_000)}M`;
    if (val >= 1_000 && val < 1_000_000) return `${parseInt(val / 1_000)}k`;
    return String(val);
  };

  function updateChart(chartData, sel1, sel2) {
    // numeric safety
    const numericValues = chartData.map(d => +String(d.Value).replace(/,/g, ""));
    const maxVal = d3.max(numericValues);
    if (!Number.isFinite(maxVal) || maxVal <= 0) {
      // show a simple red box if values are invalid (debug smoke test)
      const svgSmoke = d3.select(chartContainer.current).attr("width", width).attr("height", height);
      svgSmoke.selectAll("*").remove();
      svgSmoke.append("rect").attr("x", 10).attr("y", 10).attr("width", 80).attr("height", 40).attr("fill", "red");
      return;
    }
    const maxExponent = Math.floor(Math.log10(maxVal));

    // ticks
    const eplusmTickValues = [];
    const horizontalLines = [];
    for (let i = 0; i <= maxExponent; i++) {
      const v = i + 0.44999999999999;
      horizontalLines.push(v);
      eplusmTickValues.push(v);
    }
    const expTicks = Array.from({ length: maxExponent + 2 }, (_, i) => i);
    const allTicks = [];
    for (let exp = 0; exp <= maxExponent; exp++) {
      for (let m = 1; m < 10; m++) allTicks.push(exp + (m - 1) / 9);
    }

    const categoriesToHighlight = [sel1, sel2].filter(Boolean);

    // scales
    const x = d3.scaleBand()
      .domain([...chartData].sort((a, b) => d3.ascending(a.Category, b.Category)).map(d => d.Category))
      .range([marginLeft, width - marginRight])
      .padding(0.4);

    const y = d3.scaleLinear()
      .domain([0, maxExponent + 1])
      .range([height - marginBottom, marginTop]);

    // svg (explicit size; no percent heights while debugging)
    const svg = d3.select(chartContainer.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", null);

    svg.selectAll("*").remove();

    // background bands
    for (let exp = 0; exp <= maxExponent; exp++) {
      svg.append("rect")
        .attr("x", marginLeft)
        .attr("y", y(exp + 1))
        .attr("width", width - marginLeft - marginRight)
        .attr("height", y(exp) - y(exp + 1))
        .attr("fill", exp % 2 === 0 ? evenBackgroundColor : oddBackgroundColor);
    }

    // grids (thin)
    svg.append("g")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(d3.axisLeft(y).tickValues(horizontalLines).tickSize(-width + marginLeft + marginRight).tickFormat(""))
      .call(g => {
        g.select(".domain").remove();
        g.selectAll(".tick line").attr("stroke", GRID_STRONG).attr("stroke-opacity", 0.5).attr("stroke-width", 0.5);
      });

    // grids (thick)
    svg.append("g")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(d3.axisLeft(y).tickValues(expTicks).tickSize(-width + marginLeft + marginRight).tickFormat(""))
      .call(g => {
        g.select(".domain").remove();
        g.selectAll(".tick line").attr("stroke", GRID_STRONG).attr("stroke-width", 1);
      });

    // bars
    svg.append("g")
      .attr("fill", "#14164C")
      .selectAll("rect")
      .data(chartData, d => d.Category)
      .join("rect")
      .attr("x", d => x(d.Category))
      .attr("y", d => y(getExponentPlusMantissa(+String(d.Value).replace(/,/g, ""), 10)))
      .attr("height", d => y(0) - y(getExponentPlusMantissa(+String(d.Value).replace(/,/g, ""), 10)))
      .attr("width", x.bandwidth());

    // x-axis + highlighted labels
    const xAxis = svg.append("g")
      .attr("transform", `translate(0,${height - marginBottom})`)
      .call(d3.axisBottom(x).tickSizeOuter(0));

    xAxis.selectAll(".tick text")
      .style("font-size", "1.2rem")
      .style("font-weight", "bold")
      .style("fill", d => (categoriesToHighlight.includes(d) ? "#F85741" : "#000"));

    // left axis strong
    svg.append("g")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(d3.axisLeft(y).tickValues(expTicks).tickFormat(d => scaleExpPlusMant(d, 10)).tickSize(4))
      .call(g => g.selectAll(".tick text").style("font-size", "1rem").style("font-weight", "bold").style("fill", "#000"));

    // left axis light
    svg.append("g")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(d3.axisLeft(y).tickValues(eplusmTickValues).tickFormat(d => scaleExpPlusMant(d, 10)).tickSize(4))
      .call(g => {
        g.select(".domain").remove();
        g.selectAll(".tick text").style("font-size", "1rem").style("fill", TEXT_LIGHT);
      });

    // left axis small ticks (no labels)
    svg.append("g")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(d3.axisLeft(y).tickValues(allTicks).tickFormat("").tickSize(4))
      .call(g => g.select(".domain").remove());

    // right axis strong
    svg.append("g")
      .attr("transform", `translate(${width - marginRight},0)`)
      .call(d3.axisRight(y).tickValues(expTicks).tickFormat(d => scaleExpPlusMant(d, 10)).tickSize(4))
      .call(g => g.selectAll(".tick text").style("font-size", "1rem").style("font-weight", "bold").style("fill", "#000"));

    // right axis light
    svg.append("g")
      .attr("transform", `translate(${width - marginRight},0)`)
      .call(d3.axisRight(y).tickValues(eplusmTickValues).tickFormat(d => scaleExpPlusMant(d, 10)).tickSize(4))
      .call(g => {
        g.select(".domain").remove();
        g.selectAll(".tick text").style("font-size", "1rem").style("fill", TEXT_LIGHT);
      });

    // right axis small ticks (no labels)
    svg.append("g")
      .attr("transform", `translate(${width - marginRight},0)`)
      .call(d3.axisRight(y).tickValues(allTicks).tickFormat("").tickSize(4))
      .call(g => g.select(".domain").remove());

    // labels
    svg.append("text")
      .attr("x", marginLeft)
      .attr("y", marginTop - 15)
      .attr("text-anchor", "end")
      .text("Value")
      .attr("font-size", "1.2rem")
      .attr("fill", "#000");

    svg.append("text")
      .attr("x", marginLeft)
      .attr("y", height - 5)
      .attr("text-anchor", "start")
      .text("k = Thousand (1,000),  M = Million (1,000,000),  B = Billion (1,000,000,000)")
      .attr("alignment-baseline", "start")
      .attr("font-size", "1.2rem")
      .attr("fill", "#000");

    // highlight boxes
    categoriesToHighlight.forEach(cat => {
      const xPos = x(cat);
      if (xPos == null) return;
      const xSpace = 10;
      const yTop = marginTop - 10;
      const yBottom = height - 25;
      svg.append("rect")
        .attr("fill", "transparent")
        .attr("stroke", selectedColor)
        .attr("stroke-width", 3)
        .attr("x", xPos - xSpace)
        .attr("y", yTop)
        .attr("height", yBottom - yTop)
        .attr("width", x.bandwidth() + xSpace * 2);
    });
  }

  // explicit width/height so it’s visible even if parent has no height
  return <svg ref={chartContainer} width={800} height={500} />;
};

export default EplusM;
