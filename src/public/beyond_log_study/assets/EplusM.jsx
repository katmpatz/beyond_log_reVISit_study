import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const EplusM = ({ parameters, answers }) => {
  const { data, selectedCategory1, selectedCategory2 } = parameters;
  const chartContainer = useRef(null);

  // layout
  const width = 800, height = 500;
  const marginLeft = 60, marginRight = 60, marginTop = 40, marginBottom = 60;

  // colors (from your SCSS variables)
  const GRID_STRONG = '#18182B';
  const GRID_GREY   = '#D7D7E1'; // not used by the provided classes, but available
  const TEXT_LIGHT  = '#8E8F96';

  const selectedColor = '#F85741';
  const evenBackgroundColor = '#ffffff';
  const oddBackgroundColor  = '#f0f0f0';

  // precompute once from props (read-only)
  const maxExponent = Math.floor(
    Math.log10(d3.max(data, d => parseFloat(d.Value)))
  );

  const eplusmTickValues = [];
  const horizontalLines = [];
  for (let i = 0; i <= maxExponent; i++) {
    const v = i + 0.44999999999999;
    horizontalLines.push(v);
    eplusmTickValues.push(v);
  }

  const category1 = data.find(c => c.Category === selectedCategory1);
  const category2 = data.find(c => c.Category === selectedCategory2);
  const categoriesToHighlight = [category1, category2].filter(Boolean);

  const scaleExpPlusMant = (v, base) => {
    const exp = Math.trunc(v);
    const mant = (base / (base - 1)) * (v - exp);
    const scale = mant !== 0 ? mant * base ** (exp + 1) : base ** exp;
    const value = Math.round(scale * 100) / 100;
    let num, unit;
    if (value >= 1000 && value < 1000000) {
      num = parseInt(value / 1000); unit = 'k';
    } else if (value >= 1000000 && value < 1000000000) {
      num = parseInt(value / 1000000); unit = 'M';
    } else if (value >= 1000000000 && value < 1000000000000) {
      num = parseInt(value / 1000000000); unit = 'B';
    } else {
      num = value; unit = '';
    }
    return num + unit;
  };

  const getExponent = (value, base) => {
    const baseLog = Math.log(value) / Math.log(base);
    return Math.trunc(baseLog);
  };

  const getMantissa = (value, base) => {
    const baseLog = Math.log(value) / Math.log(base);
    return value / (base ** Math.floor(baseLog));
  };

  const getExponentPlusMantissa = (value, base) =>
    getExponent(value, base) + (getMantissa(value, base) - 1) / (base - 1);

  useEffect(() => {
    if (!Array.isArray(data)) return;
    updateChart();
    console.log(answers)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, selectedCategory1, selectedCategory2]);

  const updateChart = () => {
    // ticks
    const expTicks = [];
    for (let exp = 0; exp <= maxExponent + 1; exp++) expTicks.push(exp);

    const allTicks = [];
    for (let exp = 0; exp <= maxExponent; exp++) {
      for (let m = 1; m < 10; m++) allTicks.push(exp + (m - 1) / 9);
    }

    // scales
    const x = d3.scaleBand()
      .domain(structuredClone(data)
        .sort((a, b) => d3.ascending(a.Category, b.Category))
        .map(d => d.Category))
      .range([marginLeft, width - marginRight])
      .padding(0.4);

    const y = d3.scaleLinear()
      .domain([0, maxExponent + 1])
      .range([height - marginBottom, marginTop]);

    // svg
    const svg = d3.select(chartContainer.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height])
      .attr('style', 'max-width: 100%; height: auto; max-height:80%; min-width: 100%; min-height:80%');

    svg.selectAll('*').remove();

    // background bands
    for (let exp = 0; exp <= maxExponent; exp++) {
      svg.append('rect')
        .attr('x', marginLeft)
        .attr('y', y(exp + 1))
        .attr('width', width - marginLeft - marginRight)
        .attr('height', y(exp) - y(exp + 1))
        .attr('fill', exp % 2 === 0 ? evenBackgroundColor : oddBackgroundColor);
    }

    // marker
    svg.append('defs').append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 5).attr('refY', 5)
      .attr('markerWidth', 6).attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path').attr('d', 'M 0 0 L 10 5 L 0 10 z')
      .attr('fill', selectedColor);

    // thin grid (was .grid): stroke = GRID_STRONG, opacity 0.5, width 0.5px
    svg.append('g')
      .attr('transform', `translate(${marginLeft},0)`)
      .call(d3.axisLeft(y)
        .tickValues(horizontalLines)
        .tickSize(-width + marginLeft + marginRight)
        .tickFormat(''))
      .call(g => {
        g.select('.domain').remove();
        g.selectAll('.tick line')
          .attr('stroke', GRID_STRONG)
          .attr('stroke-opacity', 0.5)
          .attr('stroke-width', 0.5);
      });

    // thick grid (was .grid-strong): stroke = GRID_STRONG, width 1px
    svg.append('g')
      .attr('transform', `translate(${marginLeft},0)`)
      .call(d3.axisLeft(y)
        .tickValues(expTicks)
        .tickSize(-width + marginLeft + marginRight)
        .tickFormat(''))
      .call(g => {
        g.select('.domain').remove();
        g.selectAll('.tick line')
          .attr('stroke', GRID_STRONG)
          .attr('stroke-width', 1);
      });

    // bars
    svg.append('g')
      .attr('fill', '#14164C')
      .selectAll('rect')
      .data(data)
      .join('rect')
      .attr('x', d => x(d.Category))
      .attr('y', d => y(getExponentPlusMantissa(+d.Value, 10)))
      .attr('height', d => y(0) - y(getExponentPlusMantissa(+d.Value, 10)))
      .attr('width', x.bandwidth());

    // x-axis + tick styling (also apply highlight colors)
    const xAxis = svg.append('g')
      .attr('transform', `translate(0,${height - marginBottom})`)
      .call(d3.axisBottom(x).tickSizeOuter(0));

    xAxis.selectAll('.tick text')
      // base style (equivalent to .strongTextLarge in your usage)
      .style('font-size', '1.2rem')
      .style('font-weight', 'bold')
      .style('fill', d =>
        categoriesToHighlight.some(c => c.Category === d) ? selectedColor : '#000'
      );

    // left axis strong text (was .strongText)
    svg.append('g')
      .attr('transform', `translate(${marginLeft},0)`)
      .call(d3.axisLeft(y).tickValues(expTicks).tickFormat(d => scaleExpPlusMant(d, 10)).tickSize(4))
      .call(g => {
        g.selectAll('.tick text')
          .style('font-size', '1rem')
          .style('font-weight', 'bold')
          .style('fill', '#000');
      });

    // left axis light text (was .lightText)
    svg.append('g')
      .attr('transform', `translate(${marginLeft},0)`)
      .call(d3.axisLeft(y).tickValues(eplusmTickValues).tickFormat(d => scaleExpPlusMant(d, 10)).tickSize(4))
      .call(g => {
        g.select('.domain').remove();
        g.selectAll('.tick text')
          .style('font-size', '1rem')
          .style('fill', TEXT_LIGHT);
      });

    // left axis all ticks (no labels)
    svg.append('g')
      .attr('transform', `translate(${marginLeft},0)`)
      .call(d3.axisLeft(y).tickValues(allTicks).tickFormat('').tickSize(4))
      .call(g => g.select('.domain').remove());

    // right axis strong text (was .strongText)
    svg.append('g')
      .attr('transform', `translate(${width - marginRight},0)`)
      .call(d3.axisRight(y).tickValues(expTicks).tickFormat(d => scaleExpPlusMant(d, 10)).tickSize(4))
      .call(g => {
        g.selectAll('.tick text')
          .style('font-size', '1rem')
          .style('font-weight', 'bold')
          .style('fill', '#000');
      });

    // right axis light text (was .lightText)
    svg.append('g')
      .attr('transform', `translate(${width - marginRight},0)`)
      .call(d3.axisRight(y).tickValues(eplusmTickValues).tickFormat(d => scaleExpPlusMant(d, 10)).tickSize(4))
      .call(g => {
        g.select('.domain').remove();
        g.selectAll('.tick text')
          .style('font-size', '1rem')
          .style('fill', TEXT_LIGHT);
      });

    // right axis all ticks (no labels)
    svg.append('g')
      .attr('transform', `translate(${width - marginRight},0)`)
      .call(d3.axisRight(y).tickValues(allTicks).tickFormat('').tickSize(4))
      .call(g => g.select('.domain').remove());

    // labels
    svg.append('text')
      .attr('x', marginLeft)
      .attr('y', marginTop - 15)
      .attr('text-anchor', 'end')
      .text('Value')
      .attr('font-size', '1.2rem')
      .attr('fill', '#000');

    svg.append('text')
      .attr('x', marginLeft)
      .attr('y', height - 5)
      .attr('text-anchor', 'start')
      .text('k = Thousand (1,000),  M = Million (1,000,000),  B = Billion (1,000,000,000)')
      .attr('alignment-baseline', 'start')
      .attr('font-size', '1.2rem')
      .attr('fill', '#000');

    // highlight boxes
    categoriesToHighlight.forEach(c => {
      if (!c?.Category) return;
      const xSpace = 10;
      const xPosition = x(c.Category) - xSpace;
      const yPositionBottom = height - 25;
      const yPositionTop = marginTop - 10;

      svg.append('rect')
        .attr('fill', 'transparent')
        .attr('stroke', selectedColor)
        .attr('stroke-width', 3)
        .attr('x', xPosition)
        .attr('y', yPositionTop)
        .attr('height', yPositionBottom - yPositionTop)
        .attr('width', x.bandwidth() + (xSpace * 2));
    });
  };

  return <svg ref={chartContainer}></svg>;
};

export default EplusM;
